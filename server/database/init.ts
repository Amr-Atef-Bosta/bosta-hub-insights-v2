import mysql from 'mysql2/promise';
import { createClient } from 'redis';
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbPool: mysql.Pool;
let deliveriesDbPool: mysql.Pool;
let redshiftPool: any;
let redis: any;

export async function initializeDatabase() {
  logger.db('Initializing database connections...');
  
  try {
    // SSL configuration for production/staging environments
    const sslConfig = await getSSLConfig();
    
    // Initialize MySQL connection pool
    const mainPoolConfig = {
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'bosta_insights',
      timezone: '+00:00',
      // Connection pool configuration
      connectionLimit: 10,
      acquireTimeout: 60000,
      timeout: 60000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      // Reconnection settings
      reconnect: true,
      idleTimeout: 60000,
      maxIdle: 10,
      ...sslConfig
    };

    dbPool = mysql.createPool(mainPoolConfig);

    // Test the main connection pool
    const testConnection = await dbPool.getConnection();
    await testConnection.ping();
    testConnection.release();
    logger.db('MySQL connection pool established successfully');

    // Initialize deliveries database connection pool (MySQL fallback)
    const deliveriesPoolConfig = {
      host: process.env.DELIVERIES_MYSQL_HOST || process.env.MYSQL_HOST || 'localhost',
      user: process.env.DELIVERIES_MYSQL_USER || process.env.MYSQL_USER || 'root',
      password: process.env.DELIVERIES_MYSQL_PASSWORD || process.env.MYSQL_PASSWORD || '',
      database: process.env.DELIVERIES_MYSQL_DATABASE || process.env.MYSQL_DATABASE || 'bosta_insights',
      timezone: '+00:00',
      // Connection pool configuration
      connectionLimit: 10,
      acquireTimeout: 60000,
      timeout: 60000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      // Reconnection settings
      reconnect: true,
      idleTimeout: 60000,
      maxIdle: 10,
      ...sslConfig
    };

    deliveriesDbPool = mysql.createPool(deliveriesPoolConfig);

    // Test the deliveries connection pool
    const testDeliveriesConnection = await deliveriesDbPool.getConnection();
    await testDeliveriesConnection.ping();
    testDeliveriesConnection.release();
    logger.db('Deliveries database connection pool established successfully');

    // Initialize Redshift connection pool (for deliveries and businesses tables)
    if (process.env.REDSHIFT_HOST) {
      const redshiftConfig = {
        host: process.env.REDSHIFT_HOST,
        port: parseInt(process.env.REDSHIFT_PORT || '5439'),
        user: process.env.REDSHIFT_USER,
        password: process.env.REDSHIFT_PASSWORD,
        database: process.env.REDSHIFT_DATABASE,
        ssl: process.env.REDSHIFT_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 10, // maximum number of clients in the pool
        idleTimeoutMillis: 60000, // how long a client is allowed to remain idle before being closed
        connectionTimeoutMillis: 60000, // how long to wait when connecting a new client
      };

      redshiftPool = new Pool(redshiftConfig);

      // Test the Redshift connection
      try {
        const client = await redshiftPool.connect();
        await client.query('SELECT 1');
        client.release();
        logger.db('Redshift connection pool established successfully');
      } catch (redshiftError) {
        logger.warn('Redshift connection failed, falling back to MySQL for analytics queries:', redshiftError);
        redshiftPool = null;
      }
    } else {
      logger.db('No Redshift configuration found, using MySQL for all queries');
    }

    // Initialize Redis connection
    const redisHost = process.env.REDIS_HOSTNAME || 'localhost';
    const redisPort = process.env.REDIS_PORT || '6379';
    const redisUrl = `redis://${redisHost}:${redisPort}`;
    
    redis = createClient({
      url: redisUrl
    });

    redis.on('error', (err: any) => {
      logger.error('Redis connection error:', err);
    });

    redis.on('connect', () => {
      logger.db('Redis connection established successfully');
    });

    await redis.connect();

    // Create necessary tables
    await createMigrationTable();
    await createDeliveriesMigrationTable();
    await runMigrations();
    await runDeliveriesMigrations();

    logger.db('Database initialization completed successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

async function getSSLConfig() {
  // SSL configuration for staging/production environments
  if (process.env.NODE_ENV === 'staging') {
    try {
      const sslPaths = {
        ca: '/var/secrets/mysql-secrets/server-ca.pem',
        cert: '/var/secrets/mysql-secrets/client-cert.pem',
        key: '/var/secrets/mysql-secrets/client-key.pem'
      };

      // Check if SSL certificates exist
      const sslFiles = await Promise.all([
        fs.access(sslPaths.ca).then(() => true).catch(() => false),
        fs.access(sslPaths.cert).then(() => true).catch(() => false),
        fs.access(sslPaths.key).then(() => true).catch(() => false)
      ]);

      if (sslFiles.every(exists => exists)) {
        logger.db('SSL certificates found, configuring secure connection for staging');
        return {
          ssl: {
            require:true,
            ca: await fs.readFile(sslPaths.ca),
            cert: await fs.readFile(sslPaths.cert),
            key: await fs.readFile(sslPaths.key),
            // Staging-specific SSL options for self-signed certificates
            rejectUnauthorized: false
          }
        };
      } else {
        logger.warn('SSL certificates not found, using insecure connection');
        return {};
      }
    } catch (error) {
      logger.error('SSL configuration error:', error);
      // Fallback to insecure connection if SSL fails
      logger.warn('Falling back to insecure connection due to SSL configuration error');
      return {};
    }
  }

  // Production environment - strict SSL
  if (process.env.NODE_ENV === 'production') {
    try {
      const sslPaths = {
        ca: '/var/secrets/mysql-secrets/server-ca.pem',
        cert: '/var/secrets/mysql-secrets/client-cert.pem',
        key: '/var/secrets/mysql-secrets/client-key.pem'
      };

      // Check if SSL certificates exist
      const sslFiles = await Promise.all([
        fs.access(sslPaths.ca).then(() => true).catch(() => false),
        fs.access(sslPaths.cert).then(() => true).catch(() => false),
        fs.access(sslPaths.key).then(() => true).catch(() => false)
      ]);

      if (sslFiles.every(exists => exists)) {
        logger.db('SSL certificates found, configuring secure connection for production');
        return {
          ssl: {
            ca: await fs.readFile(sslPaths.ca),
            cert: await fs.readFile(sslPaths.cert),
            key: await fs.readFile(sslPaths.key),
            // Production-specific SSL options - strict validation
            rejectUnauthorized: true
          }
        };
      } else {
        logger.error('SSL certificates required but not found in production environment');
        throw new Error('SSL certificates are required for production environment');
      }
    } catch (error) {
      logger.error('SSL configuration error in production:', error);
      throw error;
    }
  }

  // Development environment - no SSL
  return {};
}

async function createMigrationTable() {
  try {
    // First, create the table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await dbPool.execute(createTableQuery);
    
    // Check what columns exist in the table
    const [columns] = await dbPool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'migrations'
    `);
    
    const existingColumns = (columns as any[]).map(col => col.COLUMN_NAME);
    
    // Add filename column if it doesn't exist
    if (!existingColumns.includes('filename')) {
      logger.db('Adding filename column to migrations table');
      await dbPool.execute('ALTER TABLE migrations ADD COLUMN filename VARCHAR(255) UNIQUE');
    }
    
    // Add migration_name column if it doesn't exist
    if (!existingColumns.includes('migration_name')) {
      logger.db('Adding migration_name column to migrations table');
      await dbPool.execute('ALTER TABLE migrations ADD COLUMN migration_name VARCHAR(255) UNIQUE');
    }
    
    logger.db('Migration table created/verified');
  } catch (error) {
    logger.error('Error creating migration table:', error);
    throw error;
  }
}

async function createDeliveriesMigrationTable() {
  try {
    // First, create the table if it doesn't exist on deliveries database
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await deliveriesDbPool.execute(createTableQuery);
    
    // Check what columns exist in the table
    const [columns] = await deliveriesDbPool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'migrations'
    `);
    
    const existingColumns = (columns as any[]).map(col => col.COLUMN_NAME);
    
    // Add filename column if it doesn't exist
    if (!existingColumns.includes('filename')) {
      logger.db('Adding filename column to deliveries migrations table');
      await deliveriesDbPool.execute('ALTER TABLE migrations ADD COLUMN filename VARCHAR(255) UNIQUE');
    }
    
    // Add migration_name column if it doesn't exist
    if (!existingColumns.includes('migration_name')) {
      logger.db('Adding migration_name column to deliveries migrations table');
      await deliveriesDbPool.execute('ALTER TABLE migrations ADD COLUMN migration_name VARCHAR(255) UNIQUE');
    }
    
    logger.db('Deliveries migration table created/verified');
  } catch (error) {
    logger.error('Error creating deliveries migration table:', error);
    throw error;
  }
}

async function runMigrations() {
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    
    // Check if migrations directory exists
    try {
      await fs.access(migrationsDir);
    } catch {
      // Create migrations directory if it doesn't exist
      await fs.mkdir(migrationsDir, { recursive: true });
      logger.db('Created migrations directory');
      return;
    }

    // Get all migration files
    const migrationFiles = await fs.readdir(migrationsDir);
    const sqlFiles = migrationFiles.filter(file => file.endsWith('.sql')).sort();

    // Filter out migrations that should run on deliveries database
    const mainMigrations = sqlFiles.filter(file => 
      !file.includes('demo_business_tables') && 
      !file.includes('deliveries_') &&
      !file.includes('merchants_')
    );

    if (mainMigrations.length === 0) {
      logger.db('No main migration files found');
      return;
    }

    // Get executed migrations - check both filename and migration_name columns
    let executedNames: string[] = [];
    try {
      // Try migration_name column first
      const [migrationNameRows] = await dbPool.execute('SELECT migration_name FROM migrations WHERE migration_name IS NOT NULL');
      executedNames = (migrationNameRows as any[]).map(row => row.migration_name);
    } catch (error) {
      try {
        // Fallback to filename column if migration_name doesn't exist
        const [filenameRows] = await dbPool.execute('SELECT filename FROM migrations WHERE filename IS NOT NULL');
        executedNames = (filenameRows as any[]).map(row => row.filename.replace('.sql', ''));
      } catch (fallbackError) {
        logger.warn('Could not read executed migrations, treating all as new');
        executedNames = [];
      }
    }

    // Run pending migrations
    for (const file of mainMigrations) {
      const migrationName = file.replace('.sql', '');
      
      if (executedNames.includes(migrationName)) {
        continue; // Skip already executed migrations
      }

      logger.db(`Running migration: ${migrationName}`);
      
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = await fs.readFile(migrationPath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await dbPool.execute(statement);
        }
      }
      
      // Mark migration as executed - handle both filename and migration_name columns
      try {
        await dbPool.execute(
          'INSERT INTO migrations (filename, migration_name) VALUES (?, ?)',
          [file, migrationName]
        );
      } catch (insertError) {
        // Fallback to single column insert if the table structure is different
        try {
          await dbPool.execute(
            'INSERT INTO migrations (migration_name) VALUES (?)',
            [migrationName]
          );
        } catch (fallbackError) {
          await dbPool.execute(
            'INSERT INTO migrations (filename) VALUES (?)',
            [file]
          );
        }
      }
      
      logger.db(`Migration completed: ${migrationName}`);
    }

    logger.db('All main migrations completed successfully');
  } catch (error) {
    logger.error('Migration error:', error);
    throw error;
  }
}

async function runDeliveriesMigrations() {
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    
    // Check if migrations directory exists
    try {
      await fs.access(migrationsDir);
    } catch {
      logger.db('No migrations directory found for deliveries');
      return;
    }

    // Get all migration files
    const migrationFiles = await fs.readdir(migrationsDir);
    const sqlFiles = migrationFiles.filter(file => file.endsWith('.sql')).sort();

    // Filter for migrations that should run on deliveries database
    const deliveriesMigrations = sqlFiles.filter(file => 
      file.includes('demo_business_tables') || 
      file.includes('deliveries_') ||
      file.includes('merchants_')
    );

    if (deliveriesMigrations.length === 0) {
      logger.db('No deliveries migration files found');
      return;
    }

    // Get executed migrations from deliveries database
    let executedNames: string[] = [];
    try {
      // Try migration_name column first
      const [migrationNameRows] = await deliveriesDbPool.execute('SELECT migration_name FROM migrations WHERE migration_name IS NOT NULL');
      executedNames = (migrationNameRows as any[]).map(row => row.migration_name);
    } catch (error) {
      try {
        // Fallback to filename column if migration_name doesn't exist
        const [filenameRows] = await deliveriesDbPool.execute('SELECT filename FROM migrations WHERE filename IS NOT NULL');
        executedNames = (filenameRows as any[]).map(row => row.filename.replace('.sql', ''));
      } catch (fallbackError) {
        logger.warn('Could not read executed deliveries migrations, treating all as new');
        executedNames = [];
      }
    }

    // Run pending deliveries migrations
    for (const file of deliveriesMigrations) {
      const migrationName = file.replace('.sql', '');
      
      if (executedNames.includes(migrationName)) {
        continue; // Skip already executed migrations
      }

      logger.db(`Running deliveries migration: ${migrationName}`);
      
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = await fs.readFile(migrationPath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await deliveriesDbPool.execute(statement);
        }
      }
      
      // Mark migration as executed on deliveries database
      try {
        await deliveriesDbPool.execute(
          'INSERT INTO migrations (filename, migration_name) VALUES (?, ?)',
          [file, migrationName]
        );
      } catch (insertError) {
        // Fallback to single column insert if the table structure is different
        try {
          await deliveriesDbPool.execute(
            'INSERT INTO migrations (migration_name) VALUES (?)',
            [migrationName]
          );
        } catch (fallbackError) {
          await deliveriesDbPool.execute(
            'INSERT INTO migrations (filename) VALUES (?)',
            [file]
          );
        }
      }
      
      logger.db(`Deliveries migration completed: ${migrationName}`);
    }

    logger.db('All deliveries migrations completed successfully');
  } catch (error) {
    logger.error('Deliveries migration error:', error);
    throw error;
  }
}

export function getDatabase() {
  return dbPool;
}

export function getDeliveriesDatabase() {
  return deliveriesDbPool;
}

export function getRedshiftDatabase() {
  return redshiftPool;
}

export function getRedis() {
  return redis;
}

export async function closeDatabase() {
  logger.db('Closing database connections...');
  
  try {
    if (dbPool) {
      await dbPool.end();
      logger.db('Main database pool closed');
    }
    
    if (deliveriesDbPool) {
      await deliveriesDbPool.end();
      logger.db('Deliveries database pool closed');
    }

    if (redshiftPool) {
      await redshiftPool.end();
      logger.db('Redshift database pool closed');
    }
    
    if (redis) {
      await redis.quit();
      logger.db('Redis connection closed');
    }
    
    logger.db('All database connections closed successfully');
  } catch (error) {
    logger.error('Error closing database connections:', error);
    throw error;
  }
}

// Helper function to execute queries on Redshift with proper parameter binding
export async function executeRedshiftQuery(sql: string, params: any[] = []): Promise<any[]> {
  if (!redshiftPool) {
    throw new Error('Redshift connection not available');
  }

  const client = await redshiftPool.connect();
  try {
    // Convert MySQL-style ? placeholders to PostgreSQL-style $1, $2, etc.
    let parameterizedSql = sql;
    let paramIndex = 1;
    
    // Replace ? with $1, $2, $3, etc.
    parameterizedSql = parameterizedSql.replace(/\?/g, () => `$${paramIndex++}`);
    
    const result = await client.query(parameterizedSql, params);
    return result.rows;
  } finally {
    client.release();
  }
}