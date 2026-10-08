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
    if (mode !== 'all' && !userId) {
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
        where = `(author_id = ? OR (author_id IN (${placeholders}) AND FIND_IN_SET('public', visibility)))`;
        params = [userId, ...followingIds];
      }
    } else if (mode === 'partner' || mode === 'friend' || mode === 'family') {
      // 群组 tab：只看该类型绑定关系成员的日记（公开或对应群组可见）
      const relTypeMap = { partner: 'couple', friend: 'friend', family: 'family' };
      const relType = relTypeMap[mode];
      const rels = await diaryQuery(
        `SELECT * FROM relationships
         WHERE (requester_id = ? OR recipient_id = ?) AND status = 'accepted' AND type = ?`,
        [userId, userId, relType]
      );
      const ids = rels.map(r => (r.requester_id === userId ? r.recipient_id : r.requester_id));
      if (ids.length === 0) {
        return res.json({ diaries: [], total: 0, page, pageSize });
      }
      const ph = ids.map(() => '?').join(',');
      where = `author_id IN (${ph}) AND (FIND_IN_SET('public', visibility) OR FIND_IN_SET('${mode}', visibility))`;
      params = [...ids];
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
      const conditions = ["FIND_IN_SET('public', visibility)", 'author_id = ?'];
      params = [userId];
      for (const g of ['partner', 'friend', 'family']) {
        if (byGroup[g].length > 0) {
          const ph = byGroup[g].map(() => '?').join(',');
          conditions.push(`(author_id IN (${ph}) AND (FIND_IN_SET('public', visibility) OR FIND_IN_SET('${g}', visibility)))`);
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
