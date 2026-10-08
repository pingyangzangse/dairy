const express = require('express');
const crypto = require('crypto');
const { diaryQuery, diaryQueryOne, diaryTransaction, authQuery } = require('../db');
const { auth } = require('../lib/authz');
const { defaultLimiter } = require('../lib/limits');
const { notify, NOTIFY_TYPE } = require('../lib/notify');

const router = express.Router();
const VALID_TYPES = new Set(['couple', 'friend', 'family']);
const TYPE_LABEL = { couple: '情侣', friend: '朋友', family: '家人' };

// 查询当前全部绑定关系（情侣最多一个；朋友、家人可多个）
router.get('/api/relationship', auth, defaultLimiter, async (req, res) => {
  try {
    const rows = await diaryQuery(
      `SELECT * FROM relationships
       WHERE (requester_id = ? OR recipient_id = ?) AND status = 'accepted'
       ORDER BY created_at ASC`,
      [req.user.id, req.user.id]
    );
    const relationships = [];
    for (const rel of rows) {
      const partnerId = rel.requester_id === req.user.id ? rel.recipient_id : rel.requester_id;
      const users = await authQuery(
        'SELECT id, username, nick_name, avatar FROM ks_users WHERE id = ? LIMIT 1',
        [partnerId]
      );
      const u = users[0] || {};
      relationships.push({ ...rel, partner_id: partnerId, username: u.username, nick_name: u.nick_name, avatar: u.avatar });
    }
    res.json({ relationships });
  } catch (err) {
    console.error('[api] /relationship error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 发送绑定申请
router.post('/api/relationship/request', auth, defaultLimiter, async (req, res) => {
  try {
    const { recipient_id, type } = req.body;
    if (!recipient_id) return res.status(400).json({ error: '请选择要绑定的对象' });
    if (!VALID_TYPES.has(type)) return res.status(400).json({ error: '关系类型不正确' });
    if (recipient_id === req.user.id) return res.status(400).json({ error: '不能绑定自己' });

    await diaryTransaction(async (conn) => {
      // 同一对人已绑定则不可重复申请
      const [acceptedPair] = await conn.query(
        `SELECT * FROM relationships
         WHERE ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))
         AND status = 'accepted'`,
        [req.user.id, recipient_id, recipient_id, req.user.id]
      );
      if (acceptedPair.length > 0) throw new Error('你们已经绑定过了');

      // 情侣关系排他：任一方已有情侣，都不能再发情侣申请（朋友/家人不限数量）
      if (type === 'couple') {
        const [couples] = await conn.query(
          `SELECT * FROM relationships
           WHERE (requester_id IN (?, ?) OR recipient_id IN (?, ?))
           AND status = 'accepted' AND type = 'couple'`,
          [req.user.id, recipient_id, req.user.id, recipient_id]
        );
        if (couples.length > 0) throw new Error('你或对方已绑定情侣关系，无法重复绑定');
      }

      const [pending] = await conn.query(
        `SELECT * FROM relationships
         WHERE requester_id = ? AND recipient_id = ? AND status = 'pending'`,
        [req.user.id, recipient_id]
      );
      if (pending.length > 0) throw new Error('已发送过申请，请等待对方回应');

      const id = crypto.randomUUID();
      await conn.query(
        'INSERT INTO relationships (id, requester_id, recipient_id, type, status) VALUES (?, ?, ?, ?, ?)',
        [id, req.user.id, recipient_id, type, 'pending']
      );
    });

    await notify({
      userId: recipient_id,
      actorId: req.user.id,
      type: NOTIFY_TYPE.REL_REQUEST,
      excerpt: TYPE_LABEL[type] || type,
    });

    res.json({ success: true, message: '绑定申请已发送' });
  } catch (err) {
    console.error('[api] /relationship/request error:', err);
    res.status(400).json({ error: err.message });
  }
});

// 收到的申请列表
router.get('/api/relationship/pending', auth, defaultLimiter, async (req, res) => {
  try {
    const rels = await diaryQuery(
      `SELECT * FROM relationships
       WHERE recipient_id = ? AND status = 'pending'`,
      [req.user.id]
    );
    const requests = [];
    for (const r of rels) {
      const rows = await authQuery(
        'SELECT id, username, nick_name, avatar FROM ks_users WHERE id = ? LIMIT 1',
        [r.requester_id]
      );
      const u = rows[0] || {};
      requests.push({ ...r, username: u.username, nick_name: u.nick_name, avatar: u.avatar });
    }
    res.json({ requests });
  } catch (err) {
    console.error('[api] /relationship/pending error:', err);
    res.status(500).json({ error: err.message });
  }
});


// 我发出的申请（待对方处理）
router.get('/api/relationship/sent', auth, defaultLimiter, async (req, res) => {
  try {
    const rels = await diaryQuery(
      "SELECT * FROM relationships WHERE requester_id = ? AND status = 'pending' ORDER BY created_at DESC",
      [req.user.id]
    );
    const requests = [];
    for (const r of rels) {
      const rows = await authQuery(
        'SELECT id, username, nick_name, avatar FROM ks_users WHERE id = ? LIMIT 1',
        [r.recipient_id]
      );
      const u = rows[0] || {};
      requests.push({ ...r, username: u.username, nick_name: u.nick_name, avatar: u.avatar });
    }
    res.json({ requests });
  } catch (err) {
    console.error('[api] /relationship/sent error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 同意 / 拒绝申请
router.post('/api/relationship/respond', auth, defaultLimiter, async (req, res) => {
  try {
    const { request_id, action } = req.body;
    if (!request_id || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: '参数错误' });
    }

    const rel = await diaryTransaction(async (conn) => {
      const [rows] = await conn.query(
        'SELECT * FROM relationships WHERE id = ? AND recipient_id = ? AND status = ? FOR UPDATE',
        [request_id, req.user.id, 'pending']
      );
      const found = rows[0];
      if (!found) throw new Error('申请不存在或已处理');

      if (action === 'accept') {
        if (found.type === 'couple') {
          const [couples] = await conn.query(
            `SELECT * FROM relationships
             WHERE (requester_id IN (?, ?) OR recipient_id IN (?, ?))
             AND status = 'accepted' AND type = 'couple'`,
            [req.user.id, found.requester_id, req.user.id, found.requester_id]
          );
          if (couples.length > 0) throw new Error('你或对方已绑定情侣关系');
        }
        await conn.query('UPDATE relationships SET status = ? WHERE id = ?', ['accepted', request_id]);
      } else {
        await conn.query('DELETE FROM relationships WHERE id = ?', [request_id]);
      }
      return found;
    });

    if (action === 'accept') {
      await notify({
        userId: rel.requester_id,
        actorId: req.user.id,
        type: NOTIFY_TYPE.REL_ACCEPTED,
        excerpt: TYPE_LABEL[rel.type] || rel.type,
      });
    }

    res.json({ success: true, message: action === 'accept' ? '已同意绑定' : '已拒绝申请' });
  } catch (err) {
    console.error('[api] /relationship/respond error:', err);
    res.status(400).json({ error: err.message });
  }
});

// 解除绑定：按关系 id 解除单条
router.post('/api/relationship/unbind', auth, defaultLimiter, async (req, res) => {
  try {
    const { relationship_id } = req.body;
    if (!relationship_id) return res.status(400).json({ error: '参数错误' });
    const result = await diaryQuery(
      `DELETE FROM relationships
       WHERE id = ? AND (requester_id = ? OR recipient_id = ?) AND status = 'accepted'`,
      [relationship_id, req.user.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: '绑定关系不存在' });
    res.json({ success: true, message: '已解除绑定' });
  } catch (err) {
    console.error('[api] /relationship/unbind error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
