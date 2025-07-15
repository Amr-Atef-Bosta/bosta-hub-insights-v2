/*
  # Phase 2 Seed Data: Validated Queries
  
  This script inserts the 4 starter validated SQL snippets
  with proper parameterized queries for the AM dashboard.
*/

-- First, insert filter dimensions
INSERT IGNORE INTO filter_dimensions (id, label, sql_param, control, values_sql, is_active) VALUES
(UUID(), 'Date Range', 'date_range', 'date_range', NULL, TRUE),
(UUID(), 'Merchant', 'merchant_id', 'multiselect', 'SELECT id, name FROM demo_merchants WHERE active = TRUE LIMIT 500', TRUE),
(UUID(), 'Tier', 'tier', 'select', 'SELECT DISTINCT tier FROM demo_merchants WHERE tier IS NOT NULL', TRUE),
(UUID(), 'Account Manager', 'am', 'select', 'SELECT DISTINCT account_manager FROM demo_merchants WHERE account_manager IS NOT NULL', TRUE),
(UUID(), 'Region', 'region', 'select', 'SELECT DISTINCT region FROM demo_addresses WHERE region IS NOT NULL', TRUE);

-- Insert the 4 starter validated queries
INSERT IGNORE INTO validated_queries (id, name, scope, sql_text, chart_hint, validated_by, validated_at, active) VALUES

-- Snippet A: AM Volume by Zone Daily
(UUID(), 'AM_VOL_ZONE_DAILY', 'AM', '
SELECT 
    DATE(d.delivery_date) as delivery_date,
    COALESCE(a.region, "Unknown") as zone,
    COUNT(d.id) as delivery_count,
    SUM(d.cod_amount) as total_cod_amount
FROM demo_deliveries d
LEFT JOIN demo_addresses a ON d.delivery_address_id = a.id
LEFT JOIN demo_merchants m ON d.merchant_id = m.id
WHERE d.delivery_date >= :start_date 
    AND d.delivery_date <= :end_date
    AND (:merchant_id IS NULL OR d.merchant_id = :merchant_id)
    AND (:region IS NULL OR a.region = :region)
    AND (:tier IS NULL OR m.tier = :tier)
    AND (:am IS NULL OR m.account_manager = :am)
GROUP BY DATE(d.delivery_date), COALESCE(a.region, "Unknown")
ORDER BY delivery_date DESC, zone
', 'stacked_bar', 'Data Team', NOW(), TRUE),

-- Snippet B: AM Revenue Monthly  
(UUID(), 'AM_REVENUE_MONTHLY', 'AM', '
SELECT 
    DATE_FORMAT(d.delivery_date, "%Y-%m") as month,
    SUM(d.cod_amount) as total_revenue,
    COUNT(d.id) as delivery_count,
    ROUND(SUM(d.cod_amount) / COUNT(d.id), 2) as avg_order_value
FROM demo_deliveries d
LEFT JOIN demo_merchants m ON d.merchant_id = m.id
LEFT JOIN demo_addresses a ON d.delivery_address_id = a.id
WHERE d.delivery_date >= :start_date 
    AND d.delivery_date <= :end_date
    AND d.status = "delivered"
    AND (:merchant_id IS NULL OR d.merchant_id = :merchant_id)
    AND (:region IS NULL OR a.region = :region)
    AND (:tier IS NULL OR m.tier = :tier)
    AND (:am IS NULL OR m.account_manager = :am)
GROUP BY DATE_FORMAT(d.delivery_date, "%Y-%m")
ORDER BY month DESC
', 'line', 'Data Team', NOW(), TRUE),

-- Snippet C: AM Revenue by Zone Daily
(UUID(), 'AM_REVENUE_ZONE_DAILY', 'AM', '
SELECT 
    DATE(d.delivery_date) as delivery_date,
    COALESCE(a.region, "Unknown") as zone,
    SUM(d.cod_amount) as daily_revenue,
    COUNT(d.id) as delivery_count,
    ROUND(AVG(d.cod_amount), 2) as avg_cod_amount
FROM demo_deliveries d
LEFT JOIN demo_addresses a ON d.delivery_address_id = a.id
LEFT JOIN demo_merchants m ON d.merchant_id = m.id
WHERE d.delivery_date >= :start_date 
    AND d.delivery_date <= :end_date
    AND d.status = "delivered"
    AND (:merchant_id IS NULL OR d.merchant_id = :merchant_id)
    AND (:region IS NULL OR a.region = :region)
    AND (:tier IS NULL OR m.tier = :tier)
    AND (:am IS NULL OR m.account_manager = :am)
GROUP BY DATE(d.delivery_date), COALESCE(a.region, "Unknown")
ORDER BY delivery_date DESC, zone
', 'stacked_bar', 'Data Team', NOW(), TRUE),

-- Snippet D: AM Revenue by Type Daily
(UUID(), 'AM_REVENUE_TYPE_DAILY', 'AM', '
SELECT 
    DATE(d.delivery_date) as delivery_date,
    m.tier as merchant_tier,
    m.business_type,
    SUM(d.cod_amount) as revenue,
    COUNT(d.id) as order_count,
    ROUND(AVG(d.cod_amount), 2) as avg_order_value,
    ROUND(SUM(d.cod_amount) / COUNT(DISTINCT m.id), 2) as revenue_per_merchant
FROM demo_deliveries d
LEFT JOIN demo_merchants m ON d.merchant_id = m.id
LEFT JOIN demo_addresses a ON d.delivery_address_id = a.id
WHERE d.delivery_date >= :start_date 
    AND d.delivery_date <= :end_date
    AND d.status = "delivered"
    AND (:merchant_id IS NULL OR d.merchant_id = :merchant_id)
    AND (:region IS NULL OR a.region = :region)
    AND (:tier IS NULL OR m.tier = :tier)
    AND (:am IS NULL OR m.account_manager = :am)
GROUP BY DATE(d.delivery_date), m.tier, m.business_type
ORDER BY delivery_date DESC, merchant_tier, business_type
', 'table', 'Data Team', NOW(), TRUE);

-- Insert the AM_VALIDATED_DASH template
INSERT IGNORE INTO dashboard_templates (id, name, scope, is_validated, layout_json) VALUES
(UUID(), 'AM_VALIDATED_DASH', 'AM', TRUE, '{
  "is_validated": true,
  "layout": [
    { 
      "type": "filter_bar", 
      "filters": ["date_range", "merchant_id", "tier", "am", "region"],
      "col": 1,
      "row": 1,
      "col_span": 5 
    },
    { 
      "type": "chart", 
      "qid": "AM_VOL_ZONE_DAILY", 
      "title": "Daily Volume by Zone",
      "col": 1,
      "row": 2,
      "col_span": 3 
    },
    { 
      "type": "kpi_card", 
      "qid": "AM_REVENUE_MONTHLY", 
      "metric": "avg_order_value",
      "title": "Average Order Value",
      "col": 4,
      "row": 2,
      "col_span": 2
    },
    { 
      "type": "chart", 
      "qid": "AM_REVENUE_ZONE_DAILY", 
      "title": "Daily Revenue by Zone",
      "col": 1,
      "row": 3,
      "col_span": 3 
    },
    { 
      "type": "table", 
      "qid": "AM_REVENUE_TYPE_DAILY", 
      "title": "Revenue Breakdown by Type",
      "col": 1,
      "row": 4,
      "col_span": 5 
    }
  ]
}'); 