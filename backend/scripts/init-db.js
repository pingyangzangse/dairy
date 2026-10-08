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

CREATE TABLE IF NOT EXISTS diary_edits (
  id VARCHAR(64) PRIMARY KEY,
  diary_id VARCHAR(64) NOT NULL,
  editor_id VARCHAR(64) NOT NULL,
  changes JSON NOT NULL COMMENT '[{field,from,to}]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_diary (diary_id)
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

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL COMMENT '接收人',
  actor_id VARCHAR(64) NOT NULL COMMENT '触发人',
  type VARCHAR(32) NOT NULL COMMENT 'comment|relationship_request|relationship_accepted',
  diary_id VARCHAR(64) DEFAULT NULL,
  excerpt VARCHAR(256) DEFAULT NULL COMMENT '摘要',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id VARCHAR(64) PRIMARY KEY,
  email_notify TINYINT(1) NOT NULL DEFAULT 1 COMMENT '邮件提醒开关',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  endpoint TEXT NOT NULL,
  keys_p256dh VARCHAR(256) NOT NULL,
  keys_auth VARCHAR(128) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_endpoint (user_id, endpoint(255)),
  INDEX idx_user (user_id)
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
