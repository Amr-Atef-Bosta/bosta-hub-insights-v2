/*
  # Phase 2: Validated Queries System
  
  Adding meta-DB tables for storing validated SQL snippets,
  caching their results, and supporting advanced filtering.
  
  This migration ADDS new tables without modifying existing Phase 1 tables.
*/

-- Validated SQL catalogue
CREATE TABLE IF NOT EXISTS validated_queries (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(64) NOT NULL,                    -- AM_VOL_ZONE_DAILY, AM_REVENUE_MONTHLY, etc.
  scope ENUM('AM','AMM','ALL') NOT NULL,
  sql_text LONGTEXT NOT NULL,                   -- SQL with :start_date, :end_date, :merchant_id placeholders
  chart_hint VARCHAR(32) DEFAULT 'auto',       -- bar | line | table | stacked_bar, etc.
  validated_by VARCHAR(64) NOT NULL,
  validated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_validated_queries_scope (scope),
  INDEX idx_validated_queries_active (active),
  INDEX idx_validated_queries_name (name)
);

-- Materialised cache for query results
CREATE TABLE IF NOT EXISTS validated_results (
  qid VARCHAR(36) NOT NULL,                     -- FK to validated_queries.id
  run_stamp DATETIME NOT NULL,
  filter_json JSON DEFAULT NULL,               -- Applied filters as JSON
  result_json LONGTEXT NOT NULL,               -- Cached query results as JSON
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (qid, run_stamp),
  FOREIGN KEY (qid) REFERENCES validated_queries(id) ON DELETE CASCADE,
  INDEX idx_validated_results_qid (qid),
  INDEX idx_validated_results_run_stamp (run_stamp)
);

-- Vector store for QueryAnswerAgent semantic search (optional FAISS/pgvector integration)
CREATE TABLE IF NOT EXISTS validated_vectors (
  qid VARCHAR(36) PRIMARY KEY,
  vector LONGBLOB DEFAULT NULL,                 -- Will store vector embeddings for semantic search
  metadata JSON DEFAULT NULL,                  -- Additional metadata for search optimization
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (qid) REFERENCES validated_queries(id) ON DELETE CASCADE
);

-- Filter dimensions configuration
CREATE TABLE IF NOT EXISTS filter_dimensions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  label VARCHAR(64) NOT NULL,                   -- Display name: "Date", "Merchant", "Tier"
  sql_param VARCHAR(32) NOT NULL,              -- Parameter name: start_date/end_date, merchant_id, tier
  control ENUM('date_range','select','multiselect','text') NOT NULL,
  values_sql TEXT DEFAULT NULL,                -- SQL to populate select options
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_filter_dimensions_param (sql_param),
  INDEX idx_filter_dimensions_active (is_active)
);

-- Dashboard templates for validated dashboards
CREATE TABLE IF NOT EXISTS dashboard_templates (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(64) NOT NULL,
  scope ENUM('AM','AMM','ALL') NOT NULL,
  is_validated BOOLEAN DEFAULT FALSE,
  layout_json LONGTEXT NOT NULL,               -- Dashboard layout as JSON
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dashboard_templates_scope (scope),
  INDEX idx_dashboard_templates_validated (is_validated)
);

-- Cache invalidation tracking
CREATE TABLE IF NOT EXISTS cache_invalidations (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  qid VARCHAR(36) NOT NULL,
  filter_hash VARCHAR(64) NOT NULL,            -- Hash of filter combination
  invalidated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (qid) REFERENCES validated_queries(id) ON DELETE CASCADE,
  INDEX idx_cache_invalidations_qid (qid),
  INDEX idx_cache_invalidations_hash (filter_hash)
); 