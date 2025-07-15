/*
  # Users Table Migration
  
  Creates the users table for authentication and user management
*/

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'leader', 'am', 'analyst') DEFAULT 'am',
  avatar_url TEXT DEFAULT NULL,
  auth_provider ENUM('google', 'dev') DEFAULT 'google',
  org_unit VARCHAR(255) DEFAULT NULL,
  google_id VARCHAR(255) DEFAULT NULL,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_users_email (email),
  INDEX idx_users_role (role),
  INDEX idx_users_google_id (google_id),
  INDEX idx_users_auth_provider (auth_provider)
); 