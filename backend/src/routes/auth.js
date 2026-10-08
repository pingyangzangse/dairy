// 认证 API：登录 / 注册 / 登出（复用 DeepTalk 的 ks_users 和 ks_tokens）
const express = require('express');
const crypto = require('crypto');
const { authQuery } = require('../db');
const { issueToken, revokeToken, hashPassword, verifyPassword, isLegacyHash } = require('../lib/authz');
const { defaultLimiter, sendCodeEmailLimiter, sendCodeIpDailyLimiter, loginByCodeLimiter } = require('../lib/limits');
const { isEmail, IDENTIFIER_MAX_LEN, PASSWORD_MAX_LEN } = require('../lib/identifier');
const mailer = require('../lib/mailer');

const CODE_TTL_MINUTES = 10;
const CODE_MAX_ATTEMPTS = 5;

function hashCode(code, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
  return `${salt}$${hash}`;
}

function verifyCode(code, stored) {
  if (typeof stored !== 'string') return false;
  const idx = stored.indexOf('$');
  if (idx <= 0) return false;
  const salt = stored.slice(0, idx);
  const candidate = hashCode(code, salt);
  const a = Buffer.from(candidate);
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function packUser(user) {
  return {
    id: user.id,
    username: user.username,
    nickName: user.nick_name,
    email: user.email,
    avatar: user.avatar,
  };
}

const router = express.Router();

// 账号密码登录
router.post('/api/auth/login', defaultLimiter, async (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.username || '').trim();
    const { password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: '账号或密码错误' });
    if (identifier.length > IDENTIFIER_MAX_LEN || String(password).length > PASSWORD_MAX_LEN) {
      return res.status(400).json({ error: '账号或密码错误' });
    }

    const user = await authQuery(
      'SELECT * FROM ks_users WHERE email = ? OR username = ? LIMIT 1',
      [identifier, identifier]
    );
    const found = user[0];
    if (!found) return res.status(401).json({ error: '账号或密码错误' });
    if (!verifyPassword(password, found.password_hash)) {
      return res.status(401).json({ error: '账号或密码错误' });
    }

    if (isLegacyHash(found.password_hash)) {
      authQuery('UPDATE ks_users SET password_hash = ? WHERE id = ?', [hashPassword(password), found.id])
        .catch(err => console.warn('[auth] 密码散列升级失败:', err.message));
    }

    const token = await issueToken(found);
    res.json({ token, user: packUser(found) });
  } catch (err) {
    console.error('[api] /auth/login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 注册
router.post('/api/auth/register', defaultLimiter, async (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.username || '').trim();
    const { password, nick_name } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: '账号或密码错误' });
    if (identifier.length > IDENTIFIER_MAX_LEN || String(password).length > PASSWORD_MAX_LEN) {
      return res.status(400).json({ error: '账号或密码错误' });
    }
    if (String(password).length < 6) return res.status(400).json({ error: '密码至少6位' });
    if (!isEmail(identifier)) return res.status(400).json({ error: '账号必须是邮箱格式' });
    if (nick_name !== undefined && String(nick_name).length > 128) {
      return res.status(400).json({ error: '昵称过长' });
    }

    const id = crypto.randomUUID();
    const username = identifier.length <= 128 ? identifier : `mail_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    try {
      await authQuery(
        'INSERT INTO ks_users (id, username, password_hash, nick_name, email, password_set_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [id, username, hashPassword(password), nick_name || identifier, identifier]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: '该邮箱已被注册' });
      }
      throw err;
    }

    const token = await issueToken({ id, username, nick_name: nick_name || identifier, email: identifier, avatar: null });
    res.json({ success: true, message: '注册成功', token, user: { id, username, nickName: nick_name || identifier, email: identifier, avatar: null } });
  } catch (err) {
    console.error('[api] /auth/register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 登出
router.post('/api/auth/logout', defaultLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) await revokeToken(token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 发送邮箱验证码
router.post('/api/auth/send-code', sendCodeEmailLimiter, sendCodeIpDailyLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ error: '请输入合法的邮箱地址' });
    if (!mailer.isConfigured()) return res.status(503).json({ error: '邮件服务未配置，请稍后再试或改用密码登录' });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await authQuery('UPDATE ks_email_codes SET used = 1 WHERE email = ? AND used = 0', [email]);
    await authQuery(
      'INSERT INTO ks_email_codes (id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)',
      [id, email, hashCode(code), expiresAt]
    );

    try {
      await mailer.sendLoginCode(email, code);
    } catch (err) {
      console.error('[auth] 验证码邮件发送失败:', err.message);
      await authQuery('DELETE FROM ks_email_codes WHERE id = ?', [id]).catch(() => {});
      return res.status(502).json({ error: '验证码发送失败，请稍后再试' });
    }

    res.json({ success: true, message: '验证码已发送，请查收邮件' });
  } catch (err) {
    console.error('[api] /auth/send-code error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 验证码登录
router.post('/api/auth/login-by-code', loginByCodeLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    if (!isEmail(email)) return res.status(400).json({ error: '请输入合法的邮箱地址' });
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: '验证码为 6 位数字' });

    const rows = await authQuery(
      `SELECT * FROM ks_email_codes
       WHERE email = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    const row = rows[0];
    if (!row) return res.status(401).json({ error: '验证码错误或已过期' });

    if (!verifyCode(code, row.code_hash)) {
      const attempts = Number(row.attempts || 0) + 1;
      await authQuery('UPDATE ks_email_codes SET attempts = ?, used = ? WHERE id = ?',
        [attempts, attempts >= CODE_MAX_ATTEMPTS ? 1 : 0, row.id]);
      return res.status(401).json({
        error: attempts >= CODE_MAX_ATTEMPTS ? '验证码错误次数过多，请重新获取' : '验证码错误或已过期',
      });
    }

    await authQuery('UPDATE ks_email_codes SET used = 1 WHERE id = ?', [row.id]);

    let user = await authQuery('SELECT * FROM ks_users WHERE email = ? LIMIT 1', [email]);
    user = user[0];
    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      const id = crypto.randomUUID();
      const username = email.length <= 128 ? email : `mail_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const nickName = (email.split('@')[0] || email).slice(0, 128);
      const placeholderHash = hashPassword(crypto.randomBytes(32).toString('hex'));
      try {
        await authQuery(
          'INSERT INTO ks_users (id, username, password_hash, nick_name, email) VALUES (?, ?, ?, ?, ?)',
          [id, username, placeholderHash, nickName, email]
        );
        user = { id, username, nick_name: nickName, email, avatar: null };
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          const found = await authQuery('SELECT * FROM ks_users WHERE email = ? LIMIT 1', [email]);
          user = found[0];
          if (!user) throw err;
        } else {
          throw err;
        }
      }
    }

    const token = await issueToken(user);
    res.json({ token, isNewUser, user: packUser(user) });
  } catch (err) {
    console.error('[api] /auth/login-by-code error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
