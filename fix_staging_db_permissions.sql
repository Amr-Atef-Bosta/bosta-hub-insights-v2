-- Grant the insights.hub user access to bosta-data database
GRANT ALL PRIVILEGES ON `bosta-data`.* TO 'insights.hub'@'%';

-- Also ensure access to the main application database
GRANT ALL PRIVILEGES ON `bosta_insight_hub`.* TO 'insights.hub'@'%';

-- If the bosta-data database doesn't exist, create it
CREATE DATABASE IF NOT EXISTS `bosta-data`;

-- Refresh privileges
FLUSH PRIVILEGES;

-- Verify the grants
SHOW GRANTS FOR 'insights.hub'@'%';
