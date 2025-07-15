/*
  # Add Google OAuth support to users table

  1. New Columns
    - `google_id` - Google user ID for OAuth linking
    - `avatar_url` - Profile picture from Google
    - `auth_provider` - Track authentication method (email, google, demo)
    - `org_unit` - Google organizational unit for role mapping
    - `last_login` - Track user activity

  2. Indexes
    - Performance indexes on google_id and auth_provider
    - Composite index for OAuth queries

  3. Constraints
    - Allow password_hash to be NULL for OAuth users
    - Ensure google_id uniqueness when present
*/

-- Add Google OAuth columns to users table
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN auth_provider ENUM('email', 'google', 'demo') NOT NULL DEFAULT 'email';
ALTER TABLE users ADD COLUMN org_unit VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN last_login TIMESTAMP DEFAULT NULL;

-- Allow password_hash to be NULL for OAuth users
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) DEFAULT NULL;

-- Create indexes for performance
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_auth_provider ON users(auth_provider);
CREATE INDEX idx_users_oauth_composite ON users(auth_provider, google_id, email);

-- Add unique constraint for google_id when not null
ALTER TABLE users ADD CONSTRAINT unique_google_id UNIQUE (google_id);

-- Update existing demo users to have correct auth_provider
UPDATE users SET auth_provider = 'demo' WHERE email LIKE '%demo%' OR name LIKE '%Demo%'; 