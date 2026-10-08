// 站内通知写入工具：评论、绑定申请等动作触发；写失败只记日志，不影响主流程
const crypto = require('crypto');
const { diaryQuery, authQuery } = require('../db');

let webpush = null;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush = require('web-push');
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@alaric.wiki',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (err) {
    console.error('[push] web-push 初始化失败:', err.message);
    webpush = null;
  }
}

const PUSH_TEXT = {
  comment: (name, excerpt) => ({ title: '新评论', body: name + ' 评论了你的日记' + (excerpt ? '：' + excerpt : '') }),
  relationship_request: (name, excerpt) => ({ title: '绑定申请', body: name + ' 请求与你绑定为「' + (excerpt || '') + '」' }),
  relationship_accepted: (name) => ({ title: '绑定成功', body: name + ' 同意了你的绑定申请' }),
};

// 发送浏览器推送（失败静默，过期订阅自动清理）
async function pushToUser(userId, actorName, type, diaryId, excerpt) {
  if (!webpush) return;
  try {
    const build = PUSH_TEXT[type];
    if (!build) return;
    const { title, body } = build(actorName, excerpt);
    const url = type === 'comment' && diaryId ? '/diaries/' + diaryId : '/bind';
    const payload = JSON.stringify({ title, body, url });
    const subs = await diaryQuery('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId]);
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.keys_p256dh, auth: s.keys_auth } },
          payload
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await diaryQuery('DELETE FROM push_subscriptions WHERE id = ?', [s.id]).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('[push] 发送失败:', err.message);
  }
}

const NOTIFY_TYPE = {
  COMMENT: 'comment',
  REL_REQUEST: 'relationship_request',
  REL_ACCEPTED: 'relationship_accepted',
};

async function notify({ userId, actorId, type, diaryId = null, excerpt = null }) {
  try {
    if (!userId || userId === actorId) return; // 自己给自己操作不提醒
    await diaryQuery(
      'INSERT INTO notifications (id, user_id, actor_id, type, diary_id, excerpt) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), userId, actorId, type, diaryId, excerpt ? String(excerpt).slice(0, 120) : null]
    );

    // 同步尝试浏览器推送：查触发人昵称用于文案
    try {
      const actors = await authQuery('SELECT nick_name, username FROM ks_users WHERE id = ? LIMIT 1', [actorId]);
      const actorName = (actors[0] && (actors[0].nick_name || actors[0].username)) || '有人';
      await pushToUser(userId, actorName, type, diaryId, excerpt ? String(excerpt).slice(0, 80) : null);
    } catch (err) {
      console.error('[notify] 推送异常:', err.message);
    }
  } catch (err) {
    console.error('[notify] 写入通知失败:', err.message);
  }
}

module.exports = { notify, NOTIFY_TYPE };
