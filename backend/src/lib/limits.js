const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const defaultLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const sendCodeEmailLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.email || ipKeyGenerator(req),
});

const sendCodeIpDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  keyGenerator: ipKeyGenerator,
});

const loginByCodeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.body?.email || ipKeyGenerator(req),
});

module.exports = {
  defaultLimiter,
  sendCodeEmailLimiter,
  sendCodeIpDailyLimiter,
  loginByCodeLimiter,
};
