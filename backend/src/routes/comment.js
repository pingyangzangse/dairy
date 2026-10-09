const express = require('express');
const crypto = require('crypto');
const { diaryQuery, diaryQueryOne, diaryInsert, authQuery } = require('../db');
const { auth } = require('../lib/authz');
const { defaultLimiter } = require('../lib/limits');
const { notify, NOTIFY_TYPE } = require('../lib/notify');

const router = express.Router();

// 获取日记评论
router.get('/api/diaries/:id/comments', auth, defaultLimiter, async (req, res) => {
  try {
    const diary = await diaryQueryOne('SELECT * FROM diaries WHERE id = ?', [req.params.id]);
    if (!diary) return res.status(404).json({ error: '日记不存在' });

    const comments = await diaryQuery(
      'SELECT * FROM comments WHERE diary_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    const authorIds = [...new Set(comments.map(c => c.author_id))];
    const users = {};
    if (authorIds.length > 0) {
      const placeholders = authorIds.map(() => '?').join(',');
      const userRows = await authQuery(
        `SELECT id, username, nick_name, avatar FROM ks_users WHERE id IN (${placeholders})`,
        authorIds
      );
      for (const u of userRows) users[u.id] = u;
    }
    const result = comments.map(c => ({
      ...c,
      username: users[c.author_id]?.username,
      nick_name: users[c.author_id]?.nick_name,
      avatar: users[c.author_id]?.avatar,
    }));
    res.json({ comments: result });
  } catch (err) {
    console.error('[api] /diaries/:id/comments error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 发表评论
router.post('/api/diaries/:id/comments', auth, defaultLimiter, async (req, res) => {
  try {
    const { content, parent_id } = req.body;
    if (!content || String(content).trim().length === 0) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }

    const diary = await diaryQueryOne('SELECT * FROM diaries WHERE id = ?', [req.params.id]);
    if (!diary) return res.status(404).json({ error: '日记不存在' });

    // 回复目标校验：父评论必须存在且属于同一篇日记
    let parent = null;
    if (parent_id) {
      parent = await diaryQueryOne(
        'SELECT * FROM comments WHERE id = ? AND diary_id = ? LIMIT 1',
        [parent_id, req.params.id]
      );
      if (!parent) return res.status(400).json({ error: '回复的评论不存在' });
    }

    const id = crypto.randomUUID();
    await diaryInsert(
      'INSERT INTO comments (id, diary_id, author_id, parent_id, content) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, req.user.id, parent ? parent.id : null, content]
    );

    // 给日记作者发评论提醒（自己评论自己不提醒，notify 内部已判）
    await notify({
      userId: diary.author_id,
      actorId: req.user.id,
      type: NOTIFY_TYPE.COMMENT,
      diaryId: diary.id,
      excerpt: String(content).slice(0, 80),
    });

    // 回复评论：提醒被回复人（被回复人就是日记作者时，上面的评论提醒已覆盖，不重复发）
    if (parent && parent.author_id !== diary.author_id) {
      await notify({
        userId: parent.author_id,
        actorId: req.user.id,
        type: NOTIFY_TYPE.REPLY,
        diaryId: diary.id,
        excerpt: String(content).slice(0, 80),
      });
    }
    const rows = await authQuery(
      'SELECT id, username, nick_name, avatar FROM ks_users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    const u = rows[0] || {};
    res.json({ success: true, comment: { id, diary_id: req.params.id, author_id: req.user.id, parent_id: parent ? parent.id : null, content, created_at: new Date(), username: u.username, nick_name: u.nick_name, avatar: u.avatar } });
  } catch (err) {
    console.error('[api] POST /diaries/:id/comments error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 删除评论
router.delete('/api/comments/:id', auth, defaultLimiter, async (req, res) => {
  try {
    const comment = await diaryQueryOne('SELECT * FROM comments WHERE id = ?', [req.params.id]);
    if (!comment) return res.status(404).json({ error: '评论不存在' });
    if (comment.author_id !== req.user.id) return res.status(403).json({ error: '无权删除' });
    await diaryQuery('DELETE FROM comments WHERE parent_id = ?', [req.params.id]);
    await diaryQuery('DELETE FROM comments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[api] DELETE /comments/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
