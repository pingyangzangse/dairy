const express = require('express');
const { authQuery, diaryQuery } = require('../db');
const { auth } = require('../lib/authz');
const { defaultLimiter } = require('../lib/limits');
const { isEmail } = require('../lib/identifier');

const router = express.Router();

// 当前用户信息
router.get('/api/user/me', auth, defaultLimiter, async (req, res) => {
  try {
    const rows = await authQuery(
      'SELECT id, username, nick_name, email, avatar, wallet_address FROM ks_users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const settings = await diaryQuery('SELECT email_notify FROM user_settings WHERE user_id = ? LIMIT 1', [user.id]);
    res.json({
      id: user.id,
      username: user.username,
      nickName: user.nick_name,
      email: user.email,
      avatar: user.avatar,
      walletAddress: user.wallet_address,
      emailNotify: settings.length === 0 ? true : settings[0].email_notify === 1,
    });
  } catch (err) {
    console.error('[api] /user/me error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 更新当前用户资料
router.patch('/api/user/profile', auth, defaultLimiter, async (req, res) => {
  try {
    const { nick_name, avatar } = req.body;
    const fields = [];
    const params = [];
    if (nick_name !== undefined) { fields.push('nick_name = ?'); params.push(String(nick_name).slice(0, 128)); }
    if (avatar !== undefined) { fields.push('avatar = ?'); params.push(String(avatar)); }
    if (fields.length === 0) return res.json({ success: true });
    params.push(req.user.id);
    await authQuery(`UPDATE ks_users SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  } catch (err) {
    console.error('[api] /user/profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 更新提醒设置（邮件提醒开关）
router.patch('/api/user/settings', auth, defaultLimiter, async (req, res) => {
  try {
    const { email_notify } = req.body;
    if (email_notify === undefined) return res.status(400).json({ error: '参数错误' });
    await diaryQuery(
      'INSERT INTO user_settings (user_id, email_notify) VALUES (?, ?) ON DUPLICATE KEY UPDATE email_notify = VALUES(email_notify)',
      [req.user.id, email_notify ? 1 : 0]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[api] /user/settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 通过邮箱搜索用户（用于绑定伴侣）
router.get('/api/user/search', auth, defaultLimiter, async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ error: '请输入合法的邮箱地址' });
    const rows = await authQuery(
      'SELECT id, username, nick_name, email, avatar FROM ks_users WHERE email = ? LIMIT 1',
      [email]
    );
    const user = rows[0];
    if (!user) return res.json({ user: null });
    if (user.id === req.user.id) return res.status(400).json({ error: '不能搜索自己' });
    res.json({ user: { id: user.id, username: user.username, nickName: user.nick_name, email: user.email, avatar: user.avatar } });
  } catch (err) {
    console.error('[api] /user/search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 用户公开资料
router.get('/api/user/:id', auth, defaultLimiter, async (req, res) => {
  try {
    const rows = await authQuery(
      'SELECT id, username, nick_name, email, avatar FROM ks_users WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({
      id: user.id,
      username: user.username,
      nickName: user.nick_name,
      avatar: user.avatar,
    });
  } catch (err) {
    console.error('[api] /user/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 用户主页的文章列表：作者本人看全部；其他人按可见群组过滤
router.get('/api/user/:id/diaries', auth, defaultLimiter, async (req, res) => {
  try {
    const authorId = req.params.id;
    const viewerId = req.user.id;
    const pageSize = 50;

    let where = 'author_id = ?';
    const params = [authorId];

    if (viewerId !== authorId) {
      // 与作者的已接受关系类型 → 可见群组
      const rels = await diaryQuery(
        `SELECT type FROM relationships
         WHERE ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))
         AND status = 'accepted'`,
        [viewerId, authorId, authorId, viewerId]
      );
      const groupMap = { couple: 'partner', friend: 'friend', family: 'family' };
      const groups = rels.map(r => groupMap[r.type]).filter(Boolean);
      const conditions = ["FIND_IN_SET('public', visibility)"];
      for (const g of groups) {
        conditions.push(`FIND_IN_SET('${g}', visibility)`);
      }
      where += ' AND (' + conditions.join(' OR ') + ')';
    }

    // 时间筛选：某一天发布的日记
    const date = String(req.query.date || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      where += ' AND DATE(created_at) = ?';
      params.push(date);
    }
    // 分类筛选：可见群组（单个）
    const VIS_FILTERS = new Set(['public', 'partner', 'friend', 'family', 'private']);
    const visFilter = String(req.query.visibility || '').trim();
    if (VIS_FILTERS.has(visFilter)) {
      where += ' AND FIND_IN_SET(?, visibility)';
      params.push(visFilter);
    }

    const diaries = await diaryQuery(
      `SELECT * FROM diaries WHERE ${where} ORDER BY created_at DESC LIMIT ?`,
      [...params, pageSize]
    );
    res.json({ diaries });
  } catch (err) {
    console.error('[api] /user/:id/diaries error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 按月统计每天发布的日记数（日历用；仅本人可查，包含私密日记）
router.get('/api/user/:id/diary-days', auth, defaultLimiter, async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: '只能查看自己的日历' });
    }
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: '参数错误' });
    }
    const start = String(year) + '-' + String(month).padStart(2, '0') + '-01';
    const rows = await diaryQuery(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count
       FROM diaries
       WHERE author_id = ? AND created_at >= ? AND created_at < ? + INTERVAL 1 MONTH
       GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')`,
      [req.user.id, start, start]
    );
    const days = {};
    for (const r of rows) {
      days[String(r.day)] = Number(r.count);
    }
    res.json({ days });
  } catch (err) {
    console.error('[api] /user/:id/diary-days error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
