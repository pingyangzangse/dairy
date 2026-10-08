const crypto = require('crypto');
const { verifyMessage } = require('ethers');

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function validateAddress(addr) {
  return typeof addr === 'string' && ADDRESS_RE.test(addr);
}

function normalizeAddress(addr) {
  return String(addr || '').trim().toLowerCase();
}

function newChallengeId() {
  return 'wc_' + crypto.randomBytes(16).toString('base64url');
}

function buildSiweMessage({ domain, uri, statement, chainId, address, nonce, expiresAt }) {
  const exp = new Date(expiresAt * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  return [
    domain + ' 请求你签名登录。',
    '',
    statement,
    '',
    '钱包地址: ' + address,
    '挑战码: ' + nonce,
    '有效期至: ' + exp,
    'URI: ' + uri,
    '链 ID: ' + chainId,
  ].join('\n');
}

function recoverAddress(message, signature) {
  return verifyMessage(message, signature);
}

module.exports = { validateAddress, normalizeAddress, newChallengeId, buildSiweMessage, recoverAddress };
