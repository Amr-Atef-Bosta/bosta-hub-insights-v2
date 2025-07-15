/*
  # Demo Business Tables Migration
  
  Creates the business tables (demo_merchants, demo_deliveries, demo_addresses, etc.) 
  that the validated queries expect, with demo data for development/staging.
  Uses demo_ prefix to avoid conflicts with existing production tables.
*/

-- Demo Merchants table
CREATE TABLE IF NOT EXISTS demo_merchants (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  tier ENUM('premium', 'standard', 'basic') DEFAULT 'standard',
  business_type ENUM('ecommerce', 'retail', 'restaurant', 'pharmacy', 'other') DEFAULT 'ecommerce',
  account_manager VARCHAR(255) DEFAULT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_demo_merchants_tier (tier),
  INDEX idx_demo_merchants_active (active),
  INDEX idx_demo_merchants_account_manager (account_manager)
);

-- Demo Addresses table
CREATE TABLE IF NOT EXISTS demo_addresses (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  street_address TEXT NOT NULL,
  city VARCHAR(100) DEFAULT NULL,
  region VARCHAR(100) DEFAULT NULL,
  postal_code VARCHAR(20) DEFAULT NULL,
  country VARCHAR(100) DEFAULT 'Egypt',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_demo_addresses_region (region),
  INDEX idx_demo_addresses_city (city)
);

-- Demo Deliveries table
CREATE TABLE IF NOT EXISTS demo_deliveries (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  merchant_id VARCHAR(36) NOT NULL,
  delivery_address_id VARCHAR(36) DEFAULT NULL,
  delivery_date DATE NOT NULL,
  status ENUM('pending', 'in_transit', 'delivered', 'failed', 'cancelled') DEFAULT 'pending',
  cod_amount DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (merchant_id) REFERENCES demo_merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (delivery_address_id) REFERENCES demo_addresses(id) ON DELETE SET NULL,
  
  INDEX idx_demo_deliveries_merchant_id (merchant_id),
  INDEX idx_demo_deliveries_delivery_date (delivery_date),
  INDEX idx_demo_deliveries_status (status),
  INDEX idx_demo_deliveries_address_id (delivery_address_id)
);

-- Demo Merchant tiers lookup table (for the tier filter options)
CREATE TABLE IF NOT EXISTS demo_merchant_tiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tier VARCHAR(50) NOT NULL UNIQUE,
  description TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert demo data for development/staging

-- Demo merchants
INSERT IGNORE INTO demo_merchants (id, name, tier, business_type, account_manager, active) VALUES
(UUID(), 'Cairo Electronics Store', 'premium', 'ecommerce', 'Ahmed Hassan', TRUE),
(UUID(), 'Alexandria Fashion Boutique', 'standard', 'retail', 'Sara Mohamed', TRUE),
(UUID(), 'Giza Restaurant Chain', 'premium', 'restaurant', 'Ahmed Hassan', TRUE),
(UUID(), 'Mansoura Pharmacy', 'basic', 'pharmacy', 'Omar Ali', TRUE),
(UUID(), 'Aswan Crafts Shop', 'standard', 'retail', 'Sara Mohamed', TRUE),
(UUID(), 'Luxor Tourist Goods', 'basic', 'retail', 'Omar Ali', TRUE),
(UUID(), 'Port Said Electronics', 'standard', 'ecommerce', 'Ahmed Hassan', TRUE),
(UUID(), 'Suez Shipping Supplies', 'premium', 'other', 'Sara Mohamed', TRUE),
(UUID(), 'Tanta Food Delivery', 'standard', 'restaurant', 'Omar Ali', TRUE),
(UUID(), 'Ismailia Tech Store', 'basic', 'ecommerce', 'Ahmed Hassan', TRUE);

-- Demo addresses
INSERT IGNORE INTO demo_addresses (id, street_address, city, region, postal_code, country) VALUES
(UUID(), '123 Tahrir Square', 'Cairo', 'Cairo', '11511', 'Egypt'),
(UUID(), '456 Corniche Road', 'Alexandria', 'Alexandria', '21500', 'Egypt'),
(UUID(), '789 Pyramid Street', 'Giza', 'Giza', '12611', 'Egypt'),
(UUID(), '321 University Avenue', 'Mansoura', 'Dakahlia', '35511', 'Egypt'),
(UUID(), '654 Nile Corniche', 'Aswan', 'Aswan', '81511', 'Egypt'),
(UUID(), '987 Temple Road', 'Luxor', 'Luxor', '85811', 'Egypt'),
(UUID(), '147 Harbor Street', 'Port Said', 'Port Said', '42511', 'Egypt'),
(UUID(), '258 Canal Boulevard', 'Suez', 'Suez', '43511', 'Egypt'),
(UUID(), '369 Cotton Market', 'Tanta', 'Gharbia', '31511', 'Egypt'),
(UUID(), '741 Industrial Zone', 'Ismailia', 'Ismailia', '41511', 'Egypt');

-- Demo deliveries (last 60 days)
INSERT IGNORE INTO demo_deliveries (id, merchant_id, delivery_address_id, delivery_date, status, cod_amount) 
SELECT 
  UUID(),
  m.id,
  a.id,
  DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND() * 60) DAY),
  CASE 
    WHEN RAND() < 0.7 THEN 'delivered'
    WHEN RAND() < 0.85 THEN 'in_transit'
    WHEN RAND() < 0.95 THEN 'pending'
    ELSE 'failed'
  END,
  ROUND(50 + (RAND() * 950), 2)
FROM demo_merchants m
CROSS JOIN demo_addresses a
WHERE RAND() < 0.3  -- 30% chance of creating a delivery for each merchant-address combination
LIMIT 500;  -- Limit to 500 demo deliveries

-- Insert tier options
INSERT IGNORE INTO demo_merchant_tiers (tier, description) VALUES
('premium', 'Premium tier merchants with high volume'),
('standard', 'Standard tier merchants with moderate volume'),
('basic', 'Basic tier merchants with low volume'); 