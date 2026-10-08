const express = require('express');
const crypto = require('crypto');
const { diaryQuery, diaryQueryOne, diaryInsert } = require('../db');
const { auth } = require('../lib/authz');
const { defaultLimiter } = require('../lib/limits');

const router = express.Router();

// 关注用户
router.post('/api/follow/:userId', auth, defaultLimiter, async (req, res) => {
  try {
    const followingId = req.params.userId;
    if (followingId === req.user.id) return res.status(400).json({ error: '不能关注自己' });

    const id = crypto.randomUUID();
    try {
      await diaryInsert(
        'INSERT INTO follows (id, follower_id, following_id) VALUES (?, ?, ?)',
        [id, req.user.id, followingId]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: '已关注该用户' });
      }
      throw err;
    }
    res.json({ success: true, message: '关注成功' });
  } catch (err) {
    console.error('[api] POST /follow/:userId error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 取消关注
router.post('/api/unfollow/:userId', auth, defaultLimiter, async (req, res) => {
  try {
    await diaryQuery(
      'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
      [req.user.id, req.params.userId]
    );
    res.json({ success: true, message: '已取消关注' });
  } catch (err) {
    console.error('[api] POST /unfollow/:userId error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 是否已关注
router.get('/api/follow/:userId', auth, defaultLimiter, async (req, res) => {
  try {
    const row = await diaryQueryOne(
      'SELECT * FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1',
      [req.user.id, req.params.userId]
    );
    res.json({ isFollowing: !!row });
  } catch (err) {
    console.error('[api] GET /follow/:userId error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
