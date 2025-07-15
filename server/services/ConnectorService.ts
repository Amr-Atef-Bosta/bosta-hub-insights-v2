import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger.js';

interface TestConnectionResult {
  success: boolean;
  tables?: string[];
  error?: string;
}

export class ConnectorService {
  async testConnection(connector: any): Promise<TestConnectionResult> {
    try {
      if (connector.kind === 'mysql') {
        return await this.testMySQLConnection(connector);
      } else if (connector.kind === 'mongo') {
        return await this.testMongoConnection(connector);
      } else {
        return {
          success: false,
          error: `Unsupported connector type: ${connector.kind}`,
        };
      }
    } catch (error) {
      logger.error('Connection test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async testMySQLConnection(connector: any): Promise<TestConnectionResult> {
    let connection: mysql.Connection | null = null;
    
    try {
      const uri = new URL(connector.conn_uri);
      const config = {
        host: uri.hostname,
        port: parseInt(uri.port) || 3306,
        user: uri.username,
        password: uri.password,
        database: uri.pathname.slice(1),
        timeout: 5000,
      };

      connection = await mysql.createConnection(config);
      
      // Test connection
      await connection.execute('SELECT 1');
      
      // Get table names
      const [rows] = await connection.execute('SHOW TABLES');
      const tables = (rows as any[]).map(row => Object.values(row)[0] as string);

      return {
        success: true,
        tables: tables.slice(0, 3), // Return first 3 tables
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MySQL connection failed',
      };
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  private async testMongoConnection(connector: any): Promise<TestConnectionResult> {
    let client: MongoClient | null = null;
    
    try {
      client = new MongoClient(connector.conn_uri, {
        serverSelectionTimeoutMS: 5000,
      });

      await client.connect();
      
      // Test connection
      await client.db().admin().ping();
      
      // Get collection names
      const db = client.db();
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(col => col.name);

      return {
        success: true,
        tables: collectionNames.slice(0, 3), // Return first 3 collections
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MongoDB connection failed',
      };
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
}