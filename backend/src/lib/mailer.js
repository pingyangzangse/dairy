// 邮件发送模块：SMTP 配置走 .env（SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM）
const nodemailer = require('nodemailer');

let transporter = null;
let configured = false;

function init() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    configured = false;
    return;
  }
  const port = parseInt(SMTP_PORT || '465', 10);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  configured = true;
}

function isConfigured() {
  return configured;
}

function fromAddress() {
  const addr = process.env.SMTP_FROM || process.env.SMTP_USER;
  return `"日记" <${addr}>`;
}

async function sendLoginCode(to, code) {
  if (!configured) throw new Error('邮件服务未配置');
  const subject = '日记登录验证码';
  const text = [
    `您的登录验证码是：${code}`,
    '',
    '验证码 10 分钟内有效，请勿泄露给他人。',
    '若非本人操作，请忽略本邮件。',
  ].join('\n');
  const html = `
<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2933;background:#ffffff">
  <h2 style="margin:0 0 16px;font-size:18px;color:#0f766e">日记</h2>
  <p style="margin:0 0 8px;font-size:14px">您的登录验证码是：</p>
  <p style="margin:0 0 16px;font-size:32px;font-weight:600;letter-spacing:8px;color:#0f766e">${code}</p>
  <p style="margin:0 0 8px;font-size:13px;color:#6b7280">验证码 <strong>10 分钟</strong>内有效，请勿泄露给他人。</p>
  <p style="margin:0;font-size:13px;color:#9ca3af">若非本人操作，请忽略本邮件。</p>
</div>`.trim();
  await transporter.sendMail({ from: fromAddress(), to, subject, text, html });
}

init();

module.exports = { isConfigured, sendLoginCode };
