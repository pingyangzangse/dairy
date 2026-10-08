const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDENTIFIER_MAX_LEN = 256;
const PASSWORD_MAX_LEN = 128;

function isEmail(s) {
  return typeof s === 'string' && EMAIL_RE.test(s);
}

function dupEntryField(err) {
  if (!err || !err.message) return null;
  const m = err.message.match(/for key '([^']+)'/);
  if (!m) return null;
  const key = m[1];
  if (key.includes('email')) return 'email';
  if (key.includes('phone')) return 'phone';
  if (key.includes('username')) return 'username';
  return null;
}

module.exports = {
  isEmail,
  IDENTIFIER_MAX_LEN,
  PASSWORD_MAX_LEN,
  dupEntryField,
};
