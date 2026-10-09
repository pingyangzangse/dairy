// 积分余额：发帖得分（points 表条数）+ 手动增减（point_adjustments 代数和）
const { diaryQuery } = require('../db');

async function getBalance(userId) {
  const earned = await diaryQuery('SELECT COUNT(*) AS c FROM points WHERE user_id = ?', [userId]);
  const adj = await diaryQuery('SELECT COALESCE(SUM(amount), 0) AS s FROM point_adjustments WHERE user_id = ?', [userId]);
  return Number(earned[0]?.c || 0) + Number(adj[0]?.s || 0);
}

module.exports = { getBalance };
