// 站内通知写入工具：评论、绑定申请等动作触发；写失败只记日志，不影响主流程
const crypto = require('crypto');
const { diaryQuery } = require('../db');

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
  } catch (err) {
    console.error('[notify] 写入通知失败:', err.message);
  }
}

module.exports = { notify, NOTIFY_TYPE };
