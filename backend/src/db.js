const mysql = require('mysql2/promise');

let authPool = null;
let diaryPool = null;

function getAuthPool() {
  if (!authPool) {
    authPool = mysql.createPool({
      host: process.env.AUTH_DB_HOST,
      port: parseInt(process.env.AUTH_DB_PORT || '3306', 10),
      user: process.env.AUTH_DB_USER,
      password: process.env.AUTH_DB_PASSWORD,
      database: process.env.AUTH_DB_NAME,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 3000,
    });
  }
  return authPool;
}

function getDiaryPool() {
  if (!diaryPool) {
    diaryPool = mysql.createPool({
      host: process.env.DIARY_DB_HOST,
      port: parseInt(process.env.DIARY_DB_PORT || '3306', 10),
      user: process.env.DIARY_DB_USER,
      password: process.env.DIARY_DB_PASSWORD,
      database: process.env.DIARY_DB_NAME,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 3000,
    });
  }
  return diaryPool;
}

async function authQuery(sql, params) {
  const [rows] = await getAuthPool().query(sql, params);
  return rows;
}

async function authQueryOne(sql, params) {
  const rows = await authQuery(sql, params);
  return rows[0] || null;
}

async function diaryQuery(sql, params) {
  const [rows] = await getDiaryPool().query(sql, params);
  return rows;
}

async function diaryQueryOne(sql, params) {
  const rows = await diaryQuery(sql, params);
  return rows[0] || null;
}

async function diaryInsert(sql, params) {
  const [result] = await getDiaryPool().query(sql, params);
  return result;
}

async function diaryTransaction(fn) {
  const conn = await getDiaryPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  authQuery,
  authQueryOne,
  diaryQuery,
  diaryQueryOne,
  diaryInsert,
  diaryTransaction,
};
