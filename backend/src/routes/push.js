// Web Push 订阅管理：VAPID 公钥下发、订阅保存/删除
const express = require('express');
const crypto = require('crypto');
const { diaryQuery } = require('../db');
const { auth } = require('../lib/authz');
const { defaultLimiter } = require('../lib/limits');

const router = express.Router();

// 下发 VAPID 公钥（前端 pushManager.subscribe 需要）
router.get('/api/push/key', defaultLimiter, (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || '';
  if (!key) return res.status(503).json({ error: '推送服务未配置' });
  res.json({ key });
});

// 保存订阅（同 endpoint 覆盖旧记录）
router.post('/api/push/subscribe', auth, defaultLimiter, async (req, res) => {
  try {
    const sub = req.body && req.body.subscription;
    const endpoint = sub && sub.endpoint;
    const p256dh = sub && sub.keys && sub.keys.p256dh;
    const authKey = sub && sub.keys && sub.keys.auth;
    if (!endpoint || !p256dh || !authKey) {
      return res.status(400).json({ error: '订阅参数不完整' });
    }
    await diaryQuery(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, keys_p256dh, keys_auth)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE keys_p256dh = VALUES(keys_p256dh), keys_auth = VALUES(keys_auth)`,
      [crypto.randomUUID(), req.user.id, String(endpoint), String(p256dh), String(authKey)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[api] /push/subscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 取消订阅
router.post('/api/push/unsubscribe', auth, defaultLimiter, async (req, res) => {
  try {
    const endpoint = String((req.body && req.body.endpoint) || '');
    if (endpoint) {
      await diaryQuery(
        'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
        [req.user.id, endpoint]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[api] /push/unsubscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
