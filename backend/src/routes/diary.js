const express = require('express');
const crypto = require('crypto');
const { diaryQuery, diaryQueryOne, diaryInsert, diaryTransaction, authQuery } = require('../db');
const { auth } = require('../lib/authz');
const { defaultLimiter } = require('../lib/limits');

const router = express.Router();
const GROUPS = new Set(['partner', 'friend', 'family']);

// 可见范围归一化：前端可传数组或字符串；public/private 独占；群组可多选存 CSV
function normalizeVisibility(input) {
  const tokens = Array.isArray(input) ? input : String(input || '').split(',');
  const clean = [...new Set(tokens.map(t => String(t).trim()).filter(Boolean))];
  if (clean.includes('public')) return 'public';
  if (clean.includes('private')) return 'private';
  const groups = clean.filter(t => GROUPS.has(t));
  if (groups.length === 0) return null;
  return groups.join(',');
}

// 创建日记
router.post('/api/diaries', auth, defaultLimiter, async (req, res) => {
  try {
    const { title, content, visibility = 'partner', images } = req.body;
    if (!content || String(content).trim().length === 0) {
      return res.status(400).json({ error: '日记内容不能为空' });
    }
    const vis = normalizeVisibility(visibility);
    if (!vis) return res.status(400).json({ error: '可见范围不正确' });

    const id = crypto.randomUUID();
    const imagesJson = images && Array.isArray(images) ? JSON.stringify(images) : null;
    await diaryInsert(
      'INSERT INTO diaries (id, author_id, title, content, visibility, images) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.user.id, title || null, content, vis, imagesJson]
    );

    // 积分：内容超过 300 字且为今天首次达标 → +1 分（每人每天最多 1 分）
    let earnedPoint = false;
    if (String(content).trim().length > 300) {
      try {
        await diaryQuery(
          'INSERT INTO points (id, user_id, diary_id, day) VALUES (?, ?, ?, CURDATE())',
          [crypto.randomUUID(), req.user.id, id]
        );
        earnedPoint = true;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') throw err; // 今天已拿过积分，不重复加
      }
    }

    const diary = await diaryQueryOne('SELECT * FROM diaries WHERE id = ?', [id]);
    res.json({ success: true, diary, earnedPoint });
  } catch (err) {
    console.error('[api] POST /diaries error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 更新日记：限作者、发布 3 天内、最多修改 3 次；只允许标题/内容/可见范围，留存修改记录
const EDIT_LIMIT = 3;
const EDIT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const VIS_LABEL = { public: '公开', private: '仅自己', partner: '伴侣', friend: '朋友', family: '家人' };

function visLabel(csv) {
  return String(csv || '').split(',').map(t => VIS_LABEL[t.trim()] || t).join('、');
}

router.patch('/api/diaries/:id', auth, defaultLimiter, async (req, res) => {
  try {
    const { title, content, visibility } = req.body;
    const diary = await diaryQueryOne('SELECT * FROM diaries WHERE id = ?', [req.params.id]);
    if (!diary) return res.status(404).json({ error: '日记不存在' });
    if (diary.author_id !== req.user.id) return res.status(403).json({ error: '无权编辑' });

    const age = Date.now() - new Date(diary.created_at).getTime();
    if (age > EDIT_WINDOW_MS) {
      return res.status(403).json({ error: '发布已超过 3 天，不能再修改' });
    }

    const countRows = await diaryQuery(
      'SELECT COUNT(*) AS c FROM diary_edits WHERE diary_id = ?',
      [diary.id]
    );
    const editCount = Number(countRows[0]?.c || 0);
    if (editCount >= EDIT_LIMIT) {
      return res.status(403).json({ error: '最多只能修改 3 次' });
    }

    // 计算变更集（只记录真正变化的字段）
    const changes = [];
    const fields = [];
    const params = [];

    if (title !== undefined && String(title || '') !== String(diary.title || '')) {
      fields.push('title = ?'); params.push(String(title || '').slice(0, 256) || null);
      changes.push({ field: 'title', from: diary.title || '', to: String(title || '').slice(0, 256) });
    }
    if (content !== undefined && String(content) !== String(diary.content)) {
      if (!String(content).trim()) return res.status(400).json({ error: '日记内容不能为空' });
      fields.push('content = ?'); params.push(String(content));
      changes.push({ field: 'content', from: String(diary.content), to: String(content) });
    }
    if (visibility !== undefined) {
      const vis = normalizeVisibility(visibility);
      if (!vis) return res.status(400).json({ error: '可见范围不正确' });
      if (vis !== String(diary.visibility)) {
        fields.push('visibility = ?'); params.push(vis);
        changes.push({ field: 'visibility', from: visLabel(diary.visibility), to: visLabel(vis) });
      }
    }

    if (fields.length === 0) {
      return res.json({ success: true, diary, editCount, editsRemaining: EDIT_LIMIT - editCount });
    }

    await diaryTransaction(async (conn) => {
      params.push(diary.id);
      await conn.query(`UPDATE diaries SET ${fields.join(', ')} WHERE id = ?`, params);
      await conn.query(
        'INSERT INTO diary_edits (id, diary_id, editor_id, changes) VALUES (?, ?, ?, ?)',
        [crypto.randomUUID(), diary.id, req.user.id, JSON.stringify(changes)]
      );
    });

    const updated = await diaryQueryOne('SELECT * FROM diaries WHERE id = ?', [diary.id]);
    res.json({ success: true, diary: updated, editCount: editCount + 1, editsRemaining: EDIT_LIMIT - editCount - 1 });
  } catch (err) {
    console.error('[api] PATCH /diaries/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 修改记录（可见该日记的人均可查看，沿用详情同款访问控制）
router.get('/api/diaries/:id/edits', auth, defaultLimiter, async (req, res) => {
  try {
    const diary = await diaryQueryOne('SELECT * FROM diaries WHERE id = ?', [req.params.id]);
    if (!diary) return res.status(404).json({ error: '日记不存在' });

    const isAuthor = diary.author_id === req.user.id;
    const visTokens = String(diary.visibility || '').split(',');
    if (visTokens.includes('private') && !isAuthor) {
      return res.status(403).json({ error: '无权查看' });
    }
    if (!isAuthor && !visTokens.includes('public')) {
      const GROUP_TO_TYPE = { partner: 'couple', friend: 'friend', family: 'family' };
      const needTypes = visTokens.map(t => GROUP_TO_TYPE[t]).filter(Boolean);
      if (needTypes.length === 0) return res.status(403).json({ error: '无权查看' });
      const ph = needTypes.map(() => '?').join(',');
      const rel = await diaryQueryOne(
        `SELECT * FROM relationships
         WHERE ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))
         AND status = 'accepted' AND type IN (${ph}) LIMIT 1`,
        [req.user.id, diary.author_id, diary.author_id, req.user.id, ...needTypes]
      );
      if (!rel) return res.status(403).json({ error: '无权查看' });
    }

    const edits = await diaryQuery(
      'SELECT * FROM diary_edits WHERE diary_id = ? ORDER BY created_at ASC',
      [diary.id]
    );
    res.json({ edits });
  } catch (err) {
    console.error('[api] GET /diaries/:id/edits error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 删除日记
router.delete('/api/diaries/:id', auth, defaultLimiter, async (req, res) => {
  try {
    const diary = await diaryQueryOne('SELECT * FROM diaries WHERE id = ?', [req.params.id]);
    if (!diary) return res.status(404).json({ error: '日记不存在' });
    if (diary.author_id !== req.user.id) return res.status(403).json({ error: '无权删除' });
    await diaryQuery('DELETE FROM diaries WHERE id = ?', [req.params.id]);
    await diaryQuery('DELETE FROM comments WHERE diary_id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[api] DELETE /diaries/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 日记详情
router.get('/api/diaries/:id', auth, defaultLimiter, async (req, res) => {
  try {
    const diary = await diaryQueryOne('SELECT * FROM diaries WHERE id = ?', [req.params.id]);
    if (!diary) return res.status(404).json({ error: '日记不存在' });

    const isAuthor = diary.author_id === req.user.id;
    const visTokens = String(diary.visibility || '').split(',');

    if (visTokens.includes('private') && !isAuthor) {
      return res.status(403).json({ error: '无权查看' });
    }
    if (!isAuthor && !visTokens.includes('public')) {
      // 群组可见（可多选）：与作者有任一对应类型的已接受关系即可
      const GROUP_TO_TYPE = { partner: 'couple', friend: 'friend', family: 'family' };
      const needTypes = visTokens.map(t => GROUP_TO_TYPE[t]).filter(Boolean);
      if (needTypes.length === 0) return res.status(403).json({ error: '无权查看' });
      const placeholders = needTypes.map(() => '?').join(',');
      const rel = await diaryQueryOne(
        `SELECT * FROM relationships
         WHERE ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))
         AND status = 'accepted' AND type IN (${placeholders}) LIMIT 1`,
        [req.user.id, diary.author_id, diary.author_id, req.user.id, ...needTypes]
      );
      if (!rel) return res.status(403).json({ error: '无权查看' });
    }

    const authorRows = await authQuery(
      'SELECT id, username, nick_name, avatar FROM ks_users WHERE id = ? LIMIT 1',
      [diary.author_id]
    );
    const author = authorRows[0];

    // 修改次数与可编辑状态（作者本人 + 3 天内 + 未达 3 次）
    const editRows = await diaryQuery(
      'SELECT COUNT(*) AS c FROM diary_edits WHERE diary_id = ?',
      [diary.id]
    );
    const editCount = Number(editRows[0]?.c || 0);
    const age = Date.now() - new Date(diary.created_at).getTime();
    const canEdit = isAuthor && editCount < 3 && age <= 3 * 24 * 60 * 60 * 1000;

    res.json({ diary: { ...diary, author, edit_count: editCount }, canEdit, editsRemaining: Math.max(0, 3 - editCount) });
  } catch (err) {
    console.error('[api] GET /diaries/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
