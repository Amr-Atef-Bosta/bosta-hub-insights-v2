/*
  # Create core tables for Bosta Insight Hub v2

  1. New Tables
    - `connectors` - Database connection configurations
    - `agent_prompts` - AI agent system prompts and configurations
    - `audit_logs` - Chat interactions and system audit logs
    - `table_access` - Role-based table access control
    - `settings` - System configuration and feature flags
    - `conversations` - Chat conversation metadata
    - `messages` - Individual chat messages

  2. Security
    - All tables use UUIDs for primary keys
    - Sensitive data like connection strings are stored as TEXT
    - Audit logging for all system interactions
    - Role-based access control implementation

  3. Indexes
    - Performance indexes on frequently queried columns
    - Composite indexes for common query patterns
*/

-- Connectors table for database connections
CREATE TABLE IF NOT EXISTS connectors (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  kind ENUM('mysql', 'mongo', 'gmail', 'gdrive') NOT NULL,
  conn_uri TEXT NOT NULL,
  schema_json LONGTEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_connectors_kind (kind),
  INDEX idx_connectors_name (name)
);

-- Agent prompts and configurations
CREATE TABLE IF NOT EXISTS agent_prompts (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  agent_name VARCHAR(100) NOT NULL UNIQUE,
  system_prompt TEXT NOT NULL,
  model VARCHAR(100) NOT NULL DEFAULT 'gpt-4.1-latest',
  tools JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agent_name (agent_name)
);

-- Table access control
CREATE TABLE IF NOT EXISTS table_access (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  role ENUM('admin', 'leader', 'am', 'analyst') NOT NULL,
  table_pattern VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_access_role (role),
  UNIQUE KEY unique_role_table (role, table_pattern)
);

-- System settings
CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_settings_key (setting_key)
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_conversations_user (user_id),
  INDEX idx_conversations_updated (updated_at)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  conversation_id VARCHAR(36) NOT NULL,
  type ENUM('user', 'assistant') NOT NULL,
  content TEXT NOT NULL,
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_messages_conversation (conversation_id),
  INDEX idx_messages_created (created_at),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(36) DEFAULT NULL,
  details JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at)
);

-- Users table for demo purposes
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'leader', 'am', 'analyst') NOT NULL DEFAULT 'analyst',
  password_hash VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role)
);