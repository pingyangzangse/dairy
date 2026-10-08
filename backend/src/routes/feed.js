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

    if (mode === 'following') {
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
    } else if (mode === 'partner') {
      // 亲友：自己的全部 + 各绑定群组按可见范围授权的日记
      const rels = await diaryQuery(
        `SELECT * FROM relationships
         WHERE (requester_id = ? OR recipient_id = ?) AND status = 'accepted'`,
        [userId, userId]
      );
      const groupMap = { couple: 'partner', friend: 'friend', family: 'family' };
      const byGroup = { partner: [], friend: [], family: [] };
      for (const r of rels) {
        const other = r.requester_id === userId ? r.recipient_id : r.requester_id;
        const g = groupMap[r.type];
        if (g) byGroup[g].push(other);
      }
      const conditions = ['author_id = ?'];
      params = [userId];
      for (const g of ['partner', 'friend', 'family']) {
        if (byGroup[g].length > 0) {
          const ph = byGroup[g].map(() => '?').join(',');
          conditions.push(`(author_id IN (${ph}) AND visibility IN ('public', '${g}'))`);
          params.push(...byGroup[g]);
        }
      }
      where = conditions.join(' OR ');
    } else {
      // 广场：公开日记 + 自己的全部 + 各群组按可见范围授权的日记
      const rels = await diaryQuery(
        `SELECT * FROM relationships
         WHERE (requester_id = ? OR recipient_id = ?) AND status = 'accepted'`,
        [userId, userId]
      );
      const groupMap = { couple: 'partner', friend: 'friend', family: 'family' };
      const byGroup = { partner: [], friend: [], family: [] };
      for (const r of rels) {
        const other = r.requester_id === userId ? r.recipient_id : r.requester_id;
        const g = groupMap[r.type];
        if (g) byGroup[g].push(other);
      }
      const conditions = ["visibility = 'public'", 'author_id = ?'];
      params = [userId];
      for (const g of ['partner', 'friend', 'family']) {
        if (byGroup[g].length > 0) {
          const ph = byGroup[g].map(() => '?').join(',');
          conditions.push(`(author_id IN (${ph}) AND visibility IN ('public', '${g}'))`);
          params.push(...byGroup[g]);
        }
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
