const express = require('express');
const crypto = require('crypto');
const { diaryQuery, diaryQueryOne, diaryInsert, authQuery } = require('../db');
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

    const diary = await diaryQueryOne('SELECT * FROM diaries WHERE id = ?', [id]);
    res.json({ success: true, diary });
  } catch (err) {
    console.error('[api] POST /diaries error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 更新日记
router.patch('/api/diaries/:id', auth, defaultLimiter, async (req, res) => {
  try {
    const { title, content, visibility, images } = req.body;
    const diary = await diaryQueryOne('SELECT * FROM diaries WHERE id = ?', [req.params.id]);
    if (!diary) return res.status(404).json({ error: '日记不存在' });
    if (diary.author_id !== req.user.id) return res.status(403).json({ error: '无权编辑' });

    const fields = [];
    const params = [];
    if (title !== undefined) { fields.push('title = ?'); params.push(title); }
    if (content !== undefined) { fields.push('content = ?'); params.push(content); }
    if (visibility !== undefined) {
      const vis = normalizeVisibility(visibility);
      if (!vis) return res.status(400).json({ error: '可见范围不正确' });
      fields.push('visibility = ?'); params.push(vis);
    }
    if (images !== undefined) { fields.push('images = ?'); params.push(images && Array.isArray(images) ? JSON.stringify(images) : null); }
    if (fields.length === 0) return res.json({ success: true, diary });

    params.push(req.params.id);
    await diaryQuery(`UPDATE diaries SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = await diaryQueryOne('SELECT * FROM diaries WHERE id = ?', [req.params.id]);
    res.json({ success: true, diary: updated });
  } catch (err) {
    console.error('[api] PATCH /diaries/:id error:', err);
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

    res.json({ diary: { ...diary, author } });
  } catch (err) {
    console.error('[api] GET /diaries/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
