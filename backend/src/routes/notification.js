// 站内通知 API：未读数（红点轮询）、列表、全部标记已读
const express = require('express');
const { diaryQuery, authQuery } = require('../db');
const { auth } = require('../lib/authz');
const { defaultLimiter } = require('../lib/limits');

const router = express.Router();

router.get('/api/notifications/unread-count', auth, defaultLimiter, async (req, res) => {
  try {
    const rows = await diaryQuery(
      'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ count: Number(rows[0]?.c || 0) });
  } catch (err) {
    console.error('[api] /notifications/unread-count error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/notifications', auth, defaultLimiter, async (req, res) => {
  try {
    const rows = await diaryQuery(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    const actorIds = [...new Set(rows.map(r => r.actor_id))];
    const users = {};
    if (actorIds.length > 0) {
      const ph = actorIds.map(() => '?').join(',');
      const us = await authQuery(
        `SELECT id, username, nick_name, avatar FROM ks_users WHERE id IN (${ph})`,
        actorIds
      );
      for (const u of us) users[u.id] = u;
    }
    res.json({
      notifications: rows.map(n => ({
        id: n.id,
        type: n.type,
        diary_id: n.diary_id,
        excerpt: n.excerpt,
        is_read: n.is_read,
        created_at: n.created_at,
        actor_name: users[n.actor_id]?.nick_name || users[n.actor_id]?.username || '有人',
        actor_avatar: users[n.actor_id]?.avatar || null,
      })),
    });
  } catch (err) {
    console.error('[api] /notifications error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/notifications/:id/read', auth, defaultLimiter, async (req, res) => {
  try {
    await diaryQuery(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[api] /notifications/:id/read error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/notifications/read', auth, defaultLimiter, async (req, res) => {
  try {
    await diaryQuery('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[api] /notifications/read error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
