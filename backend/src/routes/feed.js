const express = require('express');
const { diaryQuery, authQuery } = require('../db');
const { defaultLimiter } = require('../lib/limits');

const router = express.Router();

router.get('/api/feed', defaultLimiter, async (req, res) => {
  try {
    const mode = req.query.mode || 'all'; // all | following | partner
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize || '10', 10)));
    const offset = (page - 1) * pageSize;

    const token = req.headers.authorization?.replace('Bearer ', '');
    let userId = null;
    if (token) {
      const rows = await authQuery('SELECT user_id FROM ks_tokens WHERE token = ? AND expires_at > NOW() LIMIT 1', [token]);
      if (rows[0]) userId = rows[0].user_id;
    }
    if ((mode === 'partner' || mode === 'following') && !userId) {
      return res.status(401).json({ error: '请先登录' });
    }

    let where = '';
    let params = [];

    if (mode === 'partner') {
      // 仅看伴侣：自己的日记（全部）+ 伴侣的日记（全部，因为伴侣可见的已授权）
      const rels = await diaryQuery(
        `SELECT * FROM relationships
         WHERE (requester_id = ? OR recipient_id = ?) AND status = 'accepted'`,
        [userId, userId]
      );
      const partnerIds = rels.map(r => r.requester_id === userId ? r.recipient_id : r.requester_id);
      if (partnerIds.length === 0) {
        return res.json({ diaries: [], total: 0, page, pageSize });
      }
      const placeholders = partnerIds.map(() => '?').join(',');
      where = `(author_id = ? OR author_id IN (${placeholders}))`;
      params = [userId, ...partnerIds];
    } else if (mode === 'following') {
      // 仅看关注：自己的全部 + 关注者的公开日记
      const follows = await diaryQuery(
        'SELECT following_id FROM follows WHERE follower_id = ?',
        [userId]
      );
      const followingIds = follows.map(f => f.following_id);
      if (followingIds.length === 0) {
        where = 'author_id = ?';
        params = [userId];
      } else {
        const placeholders = followingIds.map(() => '?').join(',');
        where = `(author_id = ? OR (author_id IN (${placeholders}) AND visibility = 'public'))`;
        params = [userId, ...followingIds];
      }
    } else {
      // 全部：公开日记 + 自己的全部 + 伴侣的 partner/公开
      const rels = await diaryQuery(
        `SELECT * FROM relationships
         WHERE (requester_id = ? OR recipient_id = ?) AND status = 'accepted'`,
        [userId, userId]
      );
      const partnerIds = rels.map(r => r.requester_id === userId ? r.recipient_id : r.requester_id);
      const conditions = ["visibility = 'public'", 'author_id = ?'];
      params = [userId];
      if (partnerIds.length > 0) {
        const placeholders = partnerIds.map(() => '?').join(',');
        conditions.push(`(author_id IN (${placeholders}) AND visibility IN ('public', 'partner'))`);
        params.push(...partnerIds);
      }
      where = conditions.join(' OR ');
    }

    const countSql = `SELECT COUNT(*) as total FROM diaries WHERE ${where}`;
    const [countRows] = await diaryQuery(countSql, params);
    const total = countRows.total;

    const listSql = `SELECT * FROM diaries WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const diaries = await diaryQuery(listSql, [...params, pageSize, offset]);

    const authorIds = [...new Set(diaries.map(d => d.author_id))];
    const users = {};
    if (authorIds.length > 0) {
      const placeholders = authorIds.map(() => '?').join(',');
      const userRows = await authQuery(
        `SELECT id, username, nick_name, avatar FROM ks_users WHERE id IN (${placeholders})`,
        authorIds
      );
      for (const u of userRows) users[u.id] = u;
    }

    const result = diaries.map(d => ({
      ...d,
      author: users[d.author_id] || { id: d.author_id, username: '未知用户', nick_name: '', avatar: null },
    }));

    res.json({ diaries: result, total, page, pageSize });
  } catch (err) {
    console.error('[api] /feed error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
