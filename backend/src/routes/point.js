// 积分：余额与明细查询、手动增减（消费/补记，必须填原因）
const express = require('express');
const crypto = require('crypto');
const { diaryQuery } = require('../db');
const { auth } = require('../lib/authz');
const { defaultLimiter } = require('../lib/limits');
const { getBalance } = require('../lib/points');

const router = express.Router();

router.get('/api/points/summary', auth, defaultLimiter, async (req, res) => {
  try {
    const earned = await diaryQuery('SELECT COUNT(*) AS c FROM points WHERE user_id = ?', [req.user.id]);
    const balance = await getBalance(req.user.id);
    const adjustments = await diaryQuery(
      'SELECT id, amount, reason, created_at FROM point_adjustments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json({ balance, earned: Number(earned[0]?.c || 0), adjustments });
  } catch (err) {
    console.error('[api] /points/summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/points/adjust', auth, defaultLimiter, async (req, res) => {
  try {
    const amount = Math.abs(parseInt(req.body.amount, 10));
    const direction = req.body.direction === 'spend' ? 'spend' : 'add';
    const reason = String(req.body.reason || '').trim().slice(0, 128);
    if (!amount || amount < 1 || amount > 1000) {
      return res.status(400).json({ error: '积分数量必须是 1-1000 的整数' });
    }
    if (!reason) return res.status(400).json({ error: '请填写原因' });

    if (direction === 'spend') {
      const balance = await getBalance(req.user.id);
      if (balance < amount) {
        return res.status(400).json({ error: '积分余额不足（当前 ' + balance + ' 分）' });
      }
    }

    await diaryQuery(
      'INSERT INTO point_adjustments (id, user_id, amount, reason) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), req.user.id, direction === 'spend' ? -amount : amount, reason]
    );
    const balance = await getBalance(req.user.id);
    res.json({ success: true, balance });
  } catch (err) {
    console.error('[api] /points/adjust error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
