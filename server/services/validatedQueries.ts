import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDatabase, getDeliveriesDatabase, getRedis, getRedshiftDatabase, executeRedshiftQuery } from '../database/init.js';
import mysql from 'mysql2/promise';

export interface ValidatedQuery {
  id: string;
  name: string;
  scope: 'AM' | 'AMM' | 'ALL';
  sql_text: string;
  chart_hint: string;
  validated_by: string;
  validated_at: Date;
  active: boolean;
}

export interface FilterParams {
  start_date?: string;
  end_date?: string;
  merchant_id?: string;
  region?: string;
  tier?: string;
  am?: string;
  [key: string]: any;
}

export interface ValidatedResult {
  qid: string;
  run_stamp: Date;
  filter_json: FilterParams;
  result_json: any[];
}

export interface FilterDimension {
  id: string;
  label: string;
  sql_param: string;
  control: 'date_range' | 'select' | 'multiselect' | 'text';
  values_sql?: string;
  is_active: boolean;
}

export class ValidatedQueriesService {
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours
  private readonly FILTER_CACHE_TTL = 12 * 60 * 60; // 12 hours for filter options

  // Get all active validated queries
  async getValidatedQueries(scope?: string): Promise<ValidatedQuery[]> {
    const db = getDatabase();
    const queries = `
      SELECT * FROM validated_queries 
      WHERE active = TRUE 
      ${scope ? 'AND scope IN (?, "ALL")' : ''}
      ORDER BY name
    `;
    const params = scope ? [scope] : [];
    const [rows] = await db.execute(queries, params);
    return rows as ValidatedQuery[];
  }

  // Get a specific validated query by ID
  async getValidatedQuery(id: string): Promise<ValidatedQuery | null> {
    const db = getDatabase();
    const query = 'SELECT * FROM validated_queries WHERE id = ? AND active = TRUE';
    const [rows] = await db.execute(query, [id]);
    const results = rows as ValidatedQuery[];
    return results[0] || null;
  }

  // Get a specific validated query by name
  async getValidatedQueryByName(name: string): Promise<ValidatedQuery | null> {
    const db = getDatabase();
    const query = 'SELECT * FROM validated_queries WHERE name = ? AND active = TRUE';
    const [rows] = await db.execute(query, [name]);
    const results = rows as ValidatedQuery[];
    return results[0] || null;
  }

  // Get a validated query by ID or name
  async getValidatedQueryByIdOrName(identifier: string): Promise<ValidatedQuery | null> {
    // First try to get by ID
    let query = await this.getValidatedQuery(identifier);
    
    // If not found, try by name
    if (!query) {
      query = await this.getValidatedQueryByName(identifier);
    }
    
    return query;
  }

  // Create new validated query
  async createValidatedQuery(data: Omit<ValidatedQuery, 'id'>): Promise<string> {
    const db = getDatabase();
    const id = uuidv4();
    const query = `
      INSERT INTO validated_queries (id, name, scope, sql_text, chart_hint, validated_by, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await db.execute(query, [
      id, data.name, data.scope, data.sql_text, 
      data.chart_hint, data.validated_by, data.active
    ]);
    return id;
  }

  // Update validated query
  async updateValidatedQuery(id: string, data: Partial<ValidatedQuery>): Promise<void> {
    const db = getDatabase();
    const updates = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    const query = `UPDATE validated_queries SET ${updates} WHERE id = ?`;
    await db.execute(query, [...values, id]);
    
    // Invalidate all cache for this query
    await this.invalidateQueryCache(id);
  }

  // Execute validated query with filters
  async executeValidatedQuery(qid: string, filters: FilterParams = {}): Promise<{ data: any[], cached: boolean }> {
    // Get the validated query by ID or name first to get the actual query ID
    const validatedQuery = await this.getValidatedQueryByIdOrName(qid);
    if (!validatedQuery) {
      throw new Error('Validated query not found');
    }

    // Apply default filters if not provided
    const finalFilters = this.applyDefaultFilters(filters);
    
    // Generate cache key using finalFilters (not original filters)
    const cacheKey = this.generateCacheKey(validatedQuery.id, finalFilters);

    
    const redis = getRedis();
    const cached = await redis.get(cacheKey);
    if (cached) {

      return {
        data: JSON.parse(cached),
        cached: true
      };
    }


    
    // Determine which database connection to use based on table references in ORIGINAL SQL
    const usesAnalyticsTables = validatedQuery.sql_text.includes('deliveries') || 
                               validatedQuery.sql_text.includes('businesses') ||
                               validatedQuery.sql_text.includes('TO_CHAR') ||
                               validatedQuery.sql_text.includes('::numeric') ||
                               validatedQuery.sql_text.includes('${schema}');
    
    // Replace placeholders in SQL
    let sql = this.replacePlaceholders(validatedQuery.sql_text, finalFilters);
    
    let results: any[];
    
    if (usesAnalyticsTables) {
      // Try Redshift first for analytics tables, fallback to MySQL
      const redshiftDb = getRedshiftDatabase();
      
      if (redshiftDb) {
        try {
          // For Redshift, use special parameter replacement and schema handling
          const redshiftSql = this.applyRedshiftSchemaPrefix(
            this.replacePlaceholdersForRedshift(validatedQuery.sql_text, finalFilters)
          );
          results = await this.executeRedshiftQueryWithRetry(redshiftSql);
        } catch (redshiftError) {
          console.warn(`[Query] Redshift query failed, falling back to MySQL:`, redshiftError);
          const deliveriesDb = getDeliveriesDatabase();
          const [rows] = await deliveriesDb.execute(sql);
          results = rows as any[];
        }
      } else {
        console.log(`[Query] No Redshift connection available, using MySQL deliveries database`);
        // No Redshift available, use MySQL deliveries database
        const deliveriesDb = getDeliveriesDatabase();
        const [rows] = await deliveriesDb.execute(sql);
        results = rows as any[];
      }
    } else {
      // Use main MySQL database for non-analytics queries
      const dbConnection = getDatabase();
      const [rows] = await dbConnection.execute(sql);
      results = rows as any[];
    }

    // Cache results using the same finalFilters
    await this.cacheResults(validatedQuery.id, finalFilters, results);

    
    return {
      data: results,
      cached: false
    };
  }

  // Get filter dimensions
  async getFilterDimensions(): Promise<FilterDimension[]> {
    const db = getDatabase();
    const query = 'SELECT * FROM filter_dimensions WHERE is_active = TRUE ORDER BY label';
    const [rows] = await db.execute(query);
    return rows as FilterDimension[];
  }

  // Get filter options for a specific filter (with caching)
  async getFilterOptions(sql_param: string): Promise<any[]> {
    // Generate cache key for filter options
    const filterCacheKey = this.generateFilterCacheKey(sql_param);

    
    const redis = getRedis();
    const cached = await redis.get(filterCacheKey);
    if (cached) {

      return JSON.parse(cached);
    }


    
    const db = getDatabase();
    const query = 'SELECT values_sql FROM filter_dimensions WHERE sql_param = ? AND is_active = TRUE';
    const [rows] = await db.execute(query, [sql_param]);
    const results = rows as any[];
    
    if (results.length === 0 || !results[0].values_sql) {
      return [];
    }

    // Determine which database connection to use for the filter options query
    const valuesSql = results[0].values_sql;
    const usesAnalyticsTables = valuesSql.includes('deliveries') || 
                               valuesSql.includes('businesses') ||
                               valuesSql.includes('TO_CHAR') ||
                               valuesSql.includes('::numeric') ||
                               valuesSql.includes('${schema}');
    
    let options: any[];
    
    if (usesAnalyticsTables) {
      // Try Redshift first for analytics tables, fallback to MySQL
      const redshiftDb = getRedshiftDatabase();
      if (redshiftDb) {
        try {
          // Apply schema prefix for Redshift
          const redshiftSql = this.applyRedshiftSchemaPrefix(valuesSql);
          options = await this.executeRedshiftQueryWithRetry(redshiftSql);
        } catch (redshiftError) {
          console.warn(`[Filter Query] Redshift query failed, falling back to MySQL:`, redshiftError);
          const deliveriesDb = getDeliveriesDatabase();
          const [optionRows] = await deliveriesDb.execute(valuesSql);
          options = optionRows as any[];
        }
      } else {
        // No Redshift available, use MySQL deliveries database
        const deliveriesDb = getDeliveriesDatabase();
        const [optionRows] = await deliveriesDb.execute(valuesSql);
        options = optionRows as any[];
      }
    } else {
      // Use main MySQL database for non-analytics queries
      const dbConnection = getDatabase();
      const [optionRows] = await dbConnection.execute(valuesSql);
      options = optionRows as any[];
    }

    // Cache the filter options
    await this.cacheFilterOptions(sql_param, options);

    
    return options;
  }

  // Test a SQL query (for admin interface)
  async testQuery(sql: string, filters: FilterParams = {}): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const finalFilters = this.applyDefaultFilters(filters);
      
      // Determine which database connection to use based on table references in ORIGINAL SQL
      const usesAnalyticsTables = sql.includes('deliveries') || 
                                 sql.includes('businesses') ||
                                 sql.includes('TO_CHAR') ||
                                 sql.includes('::numeric') ||
                                 sql.includes('${schema}');
      
      const processedSql = this.replacePlaceholders(sql, finalFilters);
      
      let results: any[];
      
      if (usesAnalyticsTables) {
        // Try Redshift first for analytics tables, fallback to MySQL
        const redshiftDb = getRedshiftDatabase();
        if (redshiftDb) {
          try {
            // Apply schema prefix for Redshift
            const redshiftSql = this.applyRedshiftSchemaPrefix(
              this.replacePlaceholdersForRedshift(sql, finalFilters)
            );
            results = await this.executeRedshiftQueryWithRetry(redshiftSql + ' LIMIT 100');
          } catch (redshiftError) {
            const deliveriesDb = getDeliveriesDatabase();
            const [rows] = await deliveriesDb.execute(processedSql + ' LIMIT 100');
            results = rows as any[];
          }
        } else {
          const deliveriesDb = getDeliveriesDatabase();
          const [rows] = await deliveriesDb.execute(processedSql + ' LIMIT 100');
          results = rows as any[];
        }
      } else {
        const dbConnection = getDatabase();
        const [rows] = await dbConnection.execute(processedSql + ' LIMIT 100');
        results = rows as any[];
      }
      
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Materialize all validated queries (for cron job)
  async materializeAllQueries(): Promise<void> {
    const queries = await this.getValidatedQueries();
    const defaultFilters = this.applyDefaultFilters({});
    
    for (const query of queries) {
      try {
        const result = await this.executeValidatedQuery(query.id, defaultFilters);
        console.log(`Materialized ${query.name}: ${result.data.length} rows`);
      } catch (error) {
        console.error(`Failed to materialize ${query.name}:`, error);
      }
    }
  }

  // Warm up filter options cache
  async warmUpFilterCache(): Promise<void> {

    
    const dimensions = await this.getFilterDimensions();
    const filterDimensions = dimensions.filter(dim => 
      dim.control === 'select' || dim.control === 'multiselect'
    );

    for (const dimension of filterDimensions) {
      try {
        await this.getFilterOptions(dimension.sql_param);

      } catch (error) {

      }
    }
    

  }

  // Invalidate filter options cache
  async invalidateFilterCache(sql_param?: string): Promise<void> {
    const redis = getRedis();
    
    if (sql_param) {
      // Invalidate specific filter
      const filterCacheKey = this.generateFilterCacheKey(sql_param);
      await redis.del(filterCacheKey);

    } else {
      // Invalidate all filter caches
      const pattern = 'filter_options:*';
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(keys);

      }
    }
  }

  // Private helper methods
  private generateCacheKey(qid: string, filters: FilterParams): string {
    // Sort the filter object properties to ensure consistent hashing
    const sortedFilters = Object.keys(filters)
      .sort()
      .reduce((result, key) => {
        result[key] = filters[key];
        return result;
      }, {} as FilterParams);
      
    const filterHash = crypto.createHash('md5')
      .update(JSON.stringify(sortedFilters))
      .digest('hex');
    return `validated_query:${qid}:${filterHash}`;
  }

  private generateFilterCacheKey(sql_param: string): string {
    return `filter_options:${sql_param}`;
  }

  private applyDefaultFilters(filters: FilterParams): FilterParams {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    return {
      start_date: filters.start_date || thirtyDaysAgo.toISOString().split('T')[0],
      end_date: filters.end_date || now.toISOString().split('T')[0],
      ...filters
    };
  }

  private replacePlaceholders(sql: string, filters: FilterParams): string {
    let processedSql = sql;
    
    // First, find all placeholders in the SQL
    const placeholderRegex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const placeholders = [...sql.matchAll(placeholderRegex)].map(match => match[1]);
    
    // Replace each placeholder found in the SQL
    placeholders.forEach(key => {
      const placeholder = `:${key}`;
      const value = filters[key];
      
      if (value === null || value === undefined || value === '') {
        processedSql = processedSql.replace(new RegExp(placeholder, 'g'), 'NULL');
      } else if (typeof value === 'string') {
        // Check if this is a multiselect value (comma-separated)
        if (value.includes(',')) {
          // Handle multiselect values - convert to IN clause
          const values = value.split(',').map(v => v.trim()).filter(v => v);
          if (values.length > 0) {
            const quotedValues = values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
            
            // Replace the equality check with IN clause
            // Transform "field = :param" to "field IN (values)"
            const equalityPattern = new RegExp(`([a-zA-Z_][a-zA-Z0-9_.]*\\s*=\\s*)${placeholder}`, 'g');
            processedSql = processedSql.replace(equalityPattern, `$1(${quotedValues})`);
            
            // Also handle the NULL check pattern "(:param IS NULL OR field = :param)"
            const nullCheckPattern = new RegExp(`\\(${placeholder}\\s+IS\\s+NULL\\s+OR\\s+([a-zA-Z_][a-zA-Z0-9_.]*\\s*=\\s*)${placeholder}\\)`, 'gi');
            processedSql = processedSql.replace(nullCheckPattern, `$1IN (${quotedValues})`);
          } else {
            // Empty multiselect - treat as NULL
            processedSql = processedSql.replace(new RegExp(placeholder, 'g'), 'NULL');
          }
        } else {
          // Single value - normal replacement
          processedSql = processedSql.replace(new RegExp(placeholder, 'g'), `'${value.replace(/'/g, "''")}'`);
        }
      } else {
        processedSql = processedSql.replace(new RegExp(placeholder, 'g'), String(value));
      }
    });
    
    return processedSql;
  }

  private async cacheResults(qid: string, filters: FilterParams, results: any[]): Promise<void> {
    // Cache in Redis
    const cacheKey = this.generateCacheKey(qid, filters);

    
    try {
      const redis = getRedis();
      await redis.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(results));

    } catch (redisError) {

    }
    
    // Persist snapshot to database
    try {
      const db = getDatabase();
      const insertQuery = `
        INSERT INTO validated_results (qid, run_stamp, filter_json, result_json) 
        VALUES (?, NOW(), ?, ?)
        ON DUPLICATE KEY UPDATE result_json = VALUES(result_json)
      `;
      await db.execute(insertQuery, [qid, JSON.stringify(filters), JSON.stringify(results)]);

    } catch (dbError) {

    }
  }

  private async cacheFilterOptions(sql_param: string, options: any[]): Promise<void> {
    const filterCacheKey = this.generateFilterCacheKey(sql_param);

    
    try {
      const redis = getRedis();
      await redis.setEx(filterCacheKey, this.FILTER_CACHE_TTL, JSON.stringify(options));

    } catch (redisError) {

    }
  }

  private async invalidateQueryCache(qid: string): Promise<void> {
    const redis = getRedis();
    
    // Get all cached keys for this query ID
    const pattern = `validated_query:${qid}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      await redis.del(keys);
    }
    
    // Log cache invalidation
    const db = getDatabase();
    const filterHash = crypto.createHash('md5').update('*').digest('hex');
    const insertQuery = `
      INSERT INTO cache_invalidations (id, qid, filter_hash, reason) 
      VALUES (?, ?, ?, ?)
    `;
    await db.execute(insertQuery, [uuidv4(), qid, filterHash, 'Query updated']);
  }

  // Helper method to execute Redshift queries with retry logic
  private async executeRedshiftQueryWithRetry(sql: string, maxRetries = 2): Promise<any[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const results = await executeRedshiftQuery(sql);
        return results;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[Redshift] Query attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`[Redshift] Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError || new Error('Redshift query failed after all retry attempts');
  }

  // Helper method to apply Redshift schema prefix to table names
  private applyRedshiftSchemaPrefix(sql: string): string {
    const schema = process.env.REDSHIFT_SCHEMA || 'public';
    
    // First, replace any ${schema} placeholders with the actual schema name
    let processedSql = sql.replace(/\$\{schema\}/g, schema);
    
    // Then, add schema prefix to unqualified table names (deliveries, businesses)
    // This handles cases where tables are referenced without schema prefix
    processedSql = processedSql.replace(/\b(?<!\.)(deliveries|businesses)\b/g, `${schema}.$1`);
    
    // Additional Redshift-specific parameter handling
    // Ensure all string literals are properly quoted for Redshift
    processedSql = this.ensureRedshiftParameterQuoting(processedSql);
    
    return processedSql;
  }

  // Helper method to ensure proper parameter quoting for Redshift
  private ensureRedshiftParameterQuoting(sql: string): string {
    // Fix any cases where parameters might not be properly quoted
    // Look for patterns like = NULL that should be IS NULL
    let processedSql = sql.replace(/=\s*NULL/gi, 'IS NULL');
    processedSql = processedSql.replace(/!=\s*NULL/gi, 'IS NOT NULL');
    processedSql = processedSql.replace(/<>\s*NULL/gi, 'IS NOT NULL');
    
    return processedSql;
  }

  // Helper method to replace placeholders for Redshift-specific parameter handling
  private replacePlaceholdersForRedshift(sql: string, filters: FilterParams): string {
    let processedSql = sql;
    
    // First, find all placeholders in the SQL, but exclude PostgreSQL type casting (::)
    // Use negative lookbehind to avoid matching :: followed by type names
    const placeholderRegex = /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    const placeholders = [...sql.matchAll(placeholderRegex)].map(match => match[1]);
    
    // Replace each placeholder found in the SQL
    placeholders.forEach(key => {
      const placeholder = `:${key}`;
      const value = filters[key];
      
      if (value === null || value === undefined || value === '') {
        // Use negative lookbehind to avoid replacing type casting
        const replaceRegex = new RegExp(`(?<!:)${placeholder}\\b`, 'g');
        processedSql = processedSql.replace(replaceRegex, 'NULL');
      } else if (typeof value === 'string') {
        // Check if this is a multiselect value (comma-separated)
        if (value.includes(',')) {
          // Handle multiselect values - convert to IN clause
          const values = value.split(',').map(v => v.trim()).filter(v => v);
          if (values.length > 0) {
            const quotedValues = values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
            
            // Replace the equality check with IN clause
            // Transform "field = :param" to "field IN (values)"
            const equalityPattern = new RegExp(`([a-zA-Z_][a-zA-Z0-9_.]*\\s*=\\s*)(?<!:)${placeholder}\\b`, 'g');
            processedSql = processedSql.replace(equalityPattern, `$1(${quotedValues})`);
            
            // Also handle the NULL check pattern "(:param IS NULL OR field = :param)"
            const nullCheckPattern = new RegExp(`\\((?<!:)${placeholder}\\s+IS\\s+NULL\\s+OR\\s+([a-zA-Z_][a-zA-Z0-9_.]*\\s*=\\s*)(?<!:)${placeholder}\\)`, 'gi');
            processedSql = processedSql.replace(nullCheckPattern, `$1IN (${quotedValues})`);
          } else {
            // Empty multiselect - treat as NULL
            const replaceRegex = new RegExp(`(?<!:)${placeholder}\\b`, 'g');
            processedSql = processedSql.replace(replaceRegex, 'NULL');
          }
        } else {
          // Single value - normal replacement
          const replaceRegex = new RegExp(`(?<!:)${placeholder}\\b`, 'g');
          processedSql = processedSql.replace(replaceRegex, `'${value.replace(/'/g, "''")}'`);
        }
      } else {
        const replaceRegex = new RegExp(`(?<!:)${placeholder}\\b`, 'g');
        processedSql = processedSql.replace(replaceRegex, String(value));
      }
    });
    
    return processedSql;
  }
} 