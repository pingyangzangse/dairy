require('dotenv').config();
const { diaryQuery } = require('../src/db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS relationships (
  id VARCHAR(64) PRIMARY KEY,
  requester_id VARCHAR(64) NOT NULL,
  recipient_id VARCHAR(64) NOT NULL,
  type VARCHAR(32) NOT NULL COMMENT 'couple|friend|family',
  status VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending|accepted|rejected',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_relationship_pair (requester_id, recipient_id),
  INDEX idx_requester (requester_id),
  INDEX idx_recipient (recipient_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS diaries (
  id VARCHAR(64) PRIMARY KEY,
  author_id VARCHAR(64) NOT NULL,
  title VARCHAR(256) DEFAULT NULL,
  content TEXT NOT NULL,
  visibility VARCHAR(32) NOT NULL DEFAULT 'partner' COMMENT 'public|partner|private',
  images JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_author (author_id),
  INDEX idx_visibility (visibility),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(64) PRIMARY KEY,
  diary_id VARCHAR(64) NOT NULL,
  author_id VARCHAR(64) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_diary (diary_id),
  INDEX idx_author (author_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS follows (
  id VARCHAR(64) PRIMARY KEY,
  follower_id VARCHAR(64) NOT NULL,
  following_id VARCHAR(64) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_follow (follower_id, following_id),
  INDEX idx_follower (follower_id),
  INDEX idx_following (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function main() {
  for (const statement of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
    await diaryQuery(statement + ';');
  }
  console.log('[init-db] 日记业务表初始化完成');
}

main().catch(err => {
  console.error('[init-db] 初始化失败:', err.message);
  process.exit(1);
});
