const express = require('express');
const crypto = require('crypto');
const { authQuery } = require('../db');
const { issueToken, auth, hashPassword, packUser } = require('../lib/authz');
const { defaultLimiter, loginByCodeLimiter } = require('../lib/limits');
const { validateAddress, normalizeAddress, newChallengeId, buildSiweMessage, recoverAddress } = require('../lib/wallet-siwe');

const CHALLENGE_TTL_SECONDS = 300;

const router = express.Router();

function siweConfig(req) {
  return {
    domain: process.env.WALLET_SIWE_DOMAIN || req.hostname || 'localhost',
    uri: process.env.WALLET_SIWE_URI || req.protocol + '://' + req.get('host'),
    statement: process.env.WALLET_SIWE_STATEMENT || '使用钱包签名登录日记。',
    chainId: parseInt(process.env.WALLET_CHAIN_ID || '1', 10),
  };
}

function nickFromAddress(address) {
  return address.slice(0, 6) + '…' + address.slice(-4);
}

async function findUserByWallet(address) {
  const rows = await authQuery('SELECT * FROM ks_users WHERE wallet_address = ? LIMIT 1', [normalizeAddress(address)]);
  return rows[0] || null;
}

async function createWalletUser(address) {
  const id = crypto.randomUUID();
  const nickName = nickFromAddress(address);
  const placeholderHash = hashPassword(crypto.randomBytes(32).toString('hex'));
  for (let attempt = 0; attempt < 3; attempt++) {
    const suffix = attempt === 0 ? address.slice(2, 12) : crypto.randomBytes(4).toString('hex');
    const username = 'wallet_' + suffix;
    try {
      await authQuery(
        'INSERT INTO ks_users (id, username, password_hash, nick_name, wallet_address) VALUES (?, ?, ?, ?, ?)',
        [id, username, placeholderHash, nickName, address]
      );
      return { id, username, nick_name: nickName, email: null, avatar: null, wallet_address: address };
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY' || attempt === 2) throw err;
    }
  }
}

async function consumeVerifiedAddress(req, res) {
  const challengeId = String(req.body.challenge_id || '').trim();
  const signature = String(req.body.signature || '').trim();
  const address = normalizeAddress(req.body.address);
  if (!challengeId || !signature || !validateAddress(address)) {
    res.status(400).json({ error: '请求参数不完整' });
    return null;
  }
  const rows = await authQuery(
    'SELECT * FROM ks_wallet_challenges WHERE id = ? AND used = 0 AND expires_at > NOW() LIMIT 1',
    [challengeId]
  );
  const row = rows[0];
  if (!row) {
    res.status(401).json({ error: '签名挑战已过期，请重新发起' });
    return null;
  }
  if (row.wallet_address !== address) {
    res.status(400).json({ error: '签名地址与申报地址不一致' });
    return null;
  }
  await authQuery('UPDATE ks_wallet_challenges SET used = 1 WHERE id = ?', [row.id]);
  let recovered;
  try {
    recovered = normalizeAddress(recoverAddress(row.message, signature));
  } catch (err) {
    res.status(400).json({ error: '签名无法解析，请重试' });
    return null;
  }
  if (recovered !== row.wallet_address) {
    res.status(401).json({ error: '签名与钱包地址对不上' });
    return null;
  }
  return address;
}

router.post('/api/auth/wallet/challenge', defaultLimiter, async (req, res) => {
  try {
    const address = normalizeAddress(req.body.address);
    if (!validateAddress(address)) {
      return res.status(400).json({ error: '钱包地址格式不对（0x 开头共 42 位）' });
    }
    const nonce = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000);
    const id = newChallengeId();
    const message = buildSiweMessage({ ...siweConfig(req), address, nonce, expiresAt: expiresAt.getTime() / 1000 });
    await authQuery('UPDATE ks_wallet_challenges SET used = 1 WHERE wallet_address = ? AND used = 0', [address]);
    await authQuery(
      'INSERT INTO ks_wallet_challenges (id, wallet_address, nonce_hash, message, expires_at) VALUES (?, ?, ?, ?, ?)',
      [id, address, crypto.createHash('sha256').update(nonce).digest('hex'), message, expiresAt]
    );
    res.json({ challenge_id: id, message });
  } catch (err) {
    console.error('[api] /auth/wallet/challenge error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/auth/wallet/verify', loginByCodeLimiter, async (req, res) => {
  try {
    const address = await consumeVerifiedAddress(req, res);
    if (!address) return;

    let user = await findUserByWallet(address);
    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      try {
        user = await createWalletUser(address);
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') throw err;
        user = await findUserByWallet(address);
        if (!user) throw err;
        isNewUser = false;
      }
    }

    const token = await issueToken(user);
    res.json({ token, isNewUser, user: packUser(user) });
  } catch (err) {
    console.error('[api] /auth/wallet/verify error:', err);
    res.status(500).json({ error: err.message });
  }
});


// 绑定钱包到当前登录账号（body 同 verify：challenge_id + address + signature）
router.post('/api/auth/wallet/link', auth, defaultLimiter, async (req, res) => {
  try {
    const address = await consumeVerifiedAddress(req, res);
    if (!address) return;

    const existing = await findUserByWallet(address);
    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({ error: '该钱包已绑定其他账号' });
    }
    if (existing) {
      return res.json({ success: true, wallet_address: address });
    }
    try {
      await authQuery('UPDATE ks_users SET wallet_address = ? WHERE id = ?', [address, req.user.id]);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: '该钱包已绑定其他账号' });
      }
      throw err;
    }
    res.json({ success: true, wallet_address: address });
  } catch (err) {
    console.error('[api] /auth/wallet/link error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 解绑钱包：解绑后将无任何登录方式时拒绝（最后一个登录方式保护）
router.post('/api/auth/wallet/unlink', auth, defaultLimiter, async (req, res) => {
  try {
    const rows = await authQuery(
      'SELECT wallet_address, password_set_at, email FROM ks_users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    const row = rows[0];
    if (!row || !row.wallet_address) {
      return res.status(400).json({ error: '当前账号没有绑定钱包' });
    }
    const hasPassword = !!row.password_set_at;
    const hasEmail = !!row.email;
    if (!hasPassword && !hasEmail) {
      return res.status(400).json({ error: '这是最后一个登录方式，请先设置密码或绑定邮箱' });
    }
    await authQuery('UPDATE ks_users SET wallet_address = NULL WHERE id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[api] /auth/wallet/unlink error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
