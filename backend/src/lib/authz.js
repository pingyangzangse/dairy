const crypto = require('crypto');
const { authQuery, authQueryOne } = require('../db');

const TOKEN_TTL_DAYS = 30;
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function packUser(u) {
  return {
    id: u.id,
    username: u.username,
    nickName: u.nick_name,
    email: u.email,
    avatar: u.avatar,
    walletAddress: u.wallet_address,
  };
}

async function issueToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 3600 * 1000);
  await authQuery('INSERT INTO ks_tokens (token, user_id, expires_at) VALUES (?, ?, ?)', [token, user.id, expires]);
  authQuery('DELETE FROM ks_tokens WHERE expires_at < NOW()').catch(() => {});
  const packed = packUser(user);
  cache.set(token, { user: packed, at: Date.now() });
  return token;
}

async function resolveToken(token) {
  const c = cache.get(token);
  if (c && Date.now() - c.at < CACHE_TTL_MS) return c.user;
  const row = await authQueryOne(
    `SELECT u.id, u.username, u.nick_name, u.email, u.avatar, t.expires_at
     FROM ks_tokens t JOIN ks_users u ON u.id = t.user_id WHERE t.token = ?`,
    [token]
  );
  if (!row) { cache.delete(token); return null; }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    cache.delete(token);
    authQuery('DELETE FROM ks_tokens WHERE token = ?', [token]).catch(() => {});
    return null;
  }
  const user = packUser(row);
  cache.set(token, { user, at: Date.now() });
  return user;
}

async function revokeToken(token) {
  cache.delete(token);
  await authQuery('DELETE FROM ks_tokens WHERE token = ?', [token]);
}

async function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const user = await resolveToken(token);
    if (!user) return res.status(401).json({ error: '未登录' });
    req.user = user;
    next();
  } catch (err) {
    console.error('[auth] token 查询失败:', err.message);
    res.status(500).json({ error: err.message });
  }
}

function hashPassword(password) {
  const N = 16384, r = 8, p = 1;
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N, r, p }).toString('hex');
  return `s2$${N}$${r}$${p}$${salt.toString('hex')}$${hash}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  if (stored.startsWith('s2$')) {
    const parts = stored.split('$');
    if (parts.length !== 6) return false;
    const [, N, r, p, saltHex, hashHex] = parts;
    const hash = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64, { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
  }
  const legacy = crypto.createHash('sha256').update(password).digest('hex');
  return stored === legacy;
}

function isLegacyHash(stored) {
  return typeof stored === 'string' && /^[0-9a-f]{64}$/.test(stored);
}

module.exports = {
  issueToken, resolveToken, revokeToken, auth,
  hashPassword, verifyPassword, isLegacyHash,
  packUser,
};
