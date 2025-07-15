import mysql from 'mysql2/promise';
import { getDeliveriesDatabase, getRedis } from '../database/init.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

interface QueryResult {
  data: any[];
  rowCount: number;
  executionTime: number;
}

export class SQLTool {
  private maxRows = 5000;
  private queryTimeout = 8000; // 8 seconds

  async execute(query: string, connector: any): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(query, connector.userRole || 'unknown');
      const cachedResult = await this.getCachedResult(cacheKey);
      
      if (cachedResult) {
        return {
          ...cachedResult,
          executionTime: Date.now() - startTime,
        };
      }

      const result: QueryResult = await this.executeDirectMySQLQuery(query, getDeliveriesDatabase());
    

      // Cache the result
      await this.cacheResult(cacheKey, result);

      return {
        ...result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('SQL Tool execution error:', error);
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  private async executeDirectMySQLQuery(query: string, connection: mysql.Connection): Promise<QueryResult> {
    try {
      // Add LIMIT clause if not present
      const limitedQuery = this.addLimitClause(query, this.maxRows);
      
      const [rows] = await connection.execute(limitedQuery);
      const data = Array.isArray(rows) ? rows : [];

      return {
        data,
        rowCount: data.length,
        executionTime: 0, // Will be set by caller
      };
    } catch (error) {
      logger.error('Direct MySQL query execution error:', error);
      throw error;
    }
  }

  private async executeMySQLQuery(query: string, connector: any): Promise<QueryResult> {
    let connection: mysql.Connection | null = null;
    
    try {
      // Parse connection URI
      const uri = new URL(connector.conn_uri);
      const config = {
        host: uri.hostname,
        port: parseInt(uri.port) || 3306,
        user: uri.username,
        password: uri.password,
        database: uri.pathname.slice(1),
        timeout: this.queryTimeout,
      };

      connection = await mysql.createConnection(config);
      
      // Add LIMIT clause if not present
      const limitedQuery = this.addLimitClause(query, this.maxRows);
      
      const [rows] = await connection.execute(limitedQuery);
      const data = Array.isArray(rows) ? rows : [];

      return {
        data,
        rowCount: data.length,
        executionTime: 0, // Will be set by caller
      };
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  async executeMongoQuery(_query: string, _connector: any, _context: any): Promise<any> {
    // TODO: Implement MongoDB query execution
    // This is a placeholder for Phase 1
    throw new Error('MongoDB queries not yet implemented in Phase 1');
  }

  private addLimitClause(query: string, maxRows: number): string {
    const trimmedQuery = query.trim();
    const lowerQuery = trimmedQuery.toLowerCase();
    
    // Check if LIMIT already exists
    if (lowerQuery.includes('limit')) {
      return query;
    }

    // Remove trailing semicolon if present, add LIMIT, then add semicolon back
    let processedQuery = trimmedQuery;
    if (processedQuery.endsWith(';')) {
      processedQuery = processedQuery.slice(0, -1).trim();
    }

    // Add LIMIT clause
    processedQuery = `${processedQuery} LIMIT ${maxRows}`;
    
    // Add semicolon back if the original query had one
    if (trimmedQuery.endsWith(';')) {
      processedQuery += ';';
    }

    return processedQuery;
  }

  private generateCacheKey(query: string, userRole: string): string {
    const content = `${query}:${userRole}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private async getCachedResult(cacheKey: string): Promise<QueryResult | null> {
    try {
      const redis = getRedis();
      const cached = await redis.get(`query:${cacheKey}`);
      
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.error('Cache retrieval error:', error);
    }
    
    return null;
  }

  private async cacheResult(cacheKey: string, result: QueryResult): Promise<void> {
    try {
      const redis = getRedis();
      const ttl = 3600; // 1 hour default
      
      // Redis v4+ syntax with EX option for expiration in seconds
      await redis.set(`query:${cacheKey}`, JSON.stringify({
        data: result.data,
        rowCount: result.rowCount,
      }), {
        EX: ttl
      });
    } catch (error) {
      logger.error('Cache storage error:', error);
    }
  }
}