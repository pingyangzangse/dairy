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
      'SELECT id, username, nick_name, email, avatar FROM ks_users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({
      id: user.id,
      username: user.username,
      nickName: user.nick_name,
      email: user.email,
      avatar: user.avatar,
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

module.exports = router;
