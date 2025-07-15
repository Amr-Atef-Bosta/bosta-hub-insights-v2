#!/usr/bin/env node

/**
 * Bosta Insights Hub - Redis Cache Manager
 * 
 * This script provides comprehensive Redis cache management for the application
 * including clearing, inspecting, and warming up caches.
 */

import { createClient } from 'redis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const APPLICATION_KEY_PATTERNS = [
  'validated_query:*',    // Validated query results cache
  'filter_options:*',     // Filter options cache  
  'query:*',             // SQLTool query cache
];

class RedisCacheManager {
  constructor() {
    this.redisHost = process.env.REDIS_HOSTNAME || 'localhost';
    this.redisPort = process.env.REDIS_PORT || '6379';
    this.redisUrl = `redis://${this.redisHost}:${this.redisPort}`;
    this.redis = null;
  }

  async connect() {
    console.log(`Connecting to Redis at ${this.redisUrl}...`);
    
    this.redis = createClient({
      url: this.redisUrl
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    await this.redis.connect();
    console.log('✅ Connected to Redis successfully');
  }

  async disconnect() {
    if (this.redis) {
      await this.redis.disconnect();
      console.log('🔌 Disconnected from Redis');
    }
  }

  async clearAllApplicationCache() {
    console.log('\n🧹 Clearing all application cache...');
    
    let totalKeysDeleted = 0;

    for (const pattern of APPLICATION_KEY_PATTERNS) {
      console.log(`\nSearching for keys matching pattern: ${pattern}`);
      
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        console.log(`Found ${keys.length} keys to delete:`);
        keys.forEach(key => console.log(`  - ${key}`));
        
        await this.redis.del(keys);
        totalKeysDeleted += keys.length;
        console.log(`✅ Deleted ${keys.length} keys for pattern: ${pattern}`);
      } else {
        console.log(`No keys found for pattern: ${pattern}`);
      }
    }

    console.log(`\n🎉 Cache clearing completed!`);
    console.log(`Total keys deleted: ${totalKeysDeleted}`);
    
    const remainingKeys = await this.redis.dbSize();
    console.log(`Remaining keys in Redis: ${remainingKeys}`);

    return totalKeysDeleted;
  }

  async clearSpecificCache(cacheType) {
    const patternMap = {
      'queries': 'validated_query:*',
      'filters': 'filter_options:*', 
      'sql': 'query:*'
    };

    const pattern = patternMap[cacheType];
    if (!pattern) {
      throw new Error(`Unknown cache type: ${cacheType}. Available: ${Object.keys(patternMap).join(', ')}`);
    }

    console.log(`\n🧹 Clearing ${cacheType} cache (pattern: ${pattern})...`);
    
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      console.log(`Found ${keys.length} keys to delete:`);
      keys.forEach(key => console.log(`  - ${key}`));
      
      await this.redis.del(keys);
      console.log(`✅ Deleted ${keys.length} keys for ${cacheType} cache`);
      return keys.length;
    } else {
      console.log(`No keys found for ${cacheType} cache`);
      return 0;
    }
  }

  async inspectCache() {
    console.log('\n🔍 Inspecting application cache...');
    
    let totalAppKeys = 0;
    const cacheStats = {};

    for (const pattern of APPLICATION_KEY_PATTERNS) {
      const keys = await this.redis.keys(pattern);
      const cacheType = pattern.replace(':*', '');
      cacheStats[cacheType] = {
        count: keys.length,
        keys: keys.slice(0, 10) // Show first 10 keys as examples
      };
      totalAppKeys += keys.length;
    }

    console.log('\n📊 Cache Statistics:');
    for (const [type, stats] of Object.entries(cacheStats)) {
      console.log(`\n${type}:`);
      console.log(`  Count: ${stats.count}`);
      if (stats.count > 0) {
        console.log(`  Sample keys (first 10):`);
        stats.keys.forEach(key => console.log(`    - ${key}`));
        if (stats.count > 10) {
          console.log(`    ... and ${stats.count - 10} more`);
        }
      }
    }

    const totalKeys = await this.redis.dbSize();
    console.log(`\n📈 Summary:`);
    console.log(`  Total application cache keys: ${totalAppKeys}`);
    console.log(`  Total keys in Redis: ${totalKeys}`);
    console.log(`  Other keys (non-application): ${totalKeys - totalAppKeys}`);

    return cacheStats;
  }

  async getKeyDetails(keyPattern) {
    console.log(`\n🔍 Getting details for keys matching: ${keyPattern}`);
    
    const keys = await this.redis.keys(keyPattern);
    
    if (keys.length === 0) {
      console.log('No keys found matching the pattern');
      return [];
    }

    console.log(`Found ${keys.length} keys:`);
    
    const details = [];
    for (const key of keys.slice(0, 5)) { // Limit to first 5 for performance
      const ttl = await this.redis.ttl(key);
      const type = await this.redis.type(key);
      const size = await this.redis.memoryUsage(key);
      
      const detail = { key, ttl, type, size };
      details.push(detail);
      
      console.log(`\n  Key: ${key}`);
      console.log(`    Type: ${type}`);
      console.log(`    TTL: ${ttl === -1 ? 'No expiry' : ttl === -2 ? 'Expired' : `${ttl} seconds`}`);
      console.log(`    Memory: ${size ? `${Math.round(size / 1024)} KB` : 'Unknown'}`);
    }

    if (keys.length > 5) {
      console.log(`\n  ... and ${keys.length - 5} more keys`);
    }

    return details;
  }

  async warmUpFilterCache() {
    console.log('\n🔥 Warming up filter cache...');
    
    try {
      // Import the ValidatedQueriesService
      const { ValidatedQueriesService } = await import('../services/validatedQueries.js');
      const service = new ValidatedQueriesService();
      await service.warmUpFilterCache();
      console.log('✅ Filter cache warm-up completed');
    } catch (error) {
      console.error('❌ Filter cache warm-up failed:', error);
      throw error;
    }
  }

  async showUsage() {
    console.log(`
Bosta Insights Hub - Redis Cache Manager

Usage:
  node redis-manager.js <command> [options]

Commands:
  clear [type]         Clear cache (all, queries, filters, sql)
  inspect              Show cache statistics and sample keys
  details <pattern>    Show detailed info for keys matching pattern
  warmup              Warm up filter cache
  help                Show this help message

Examples:
  node redis-manager.js clear              # Clear all application cache
  node redis-manager.js clear queries      # Clear only validated query cache
  node redis-manager.js clear filters      # Clear only filter options cache
  node redis-manager.js inspect            # Show cache statistics
  node redis-manager.js details "filter_*" # Show details for filter keys
  node redis-manager.js warmup             # Warm up filter cache

Application Cache Types:
  - validated_query:*    Query results cache (24h TTL)
  - filter_options:*     Filter options cache (12h TTL) 
  - query:*             SQL tool query cache (1h TTL)

Environment Variables:
  REDIS_HOSTNAME    Redis host (default: localhost)
  REDIS_PORT        Redis port (default: 6379)
`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const option = args[1];

  if (!command || command === 'help') {
    const manager = new RedisCacheManager();
    await manager.showUsage();
    return;
  }

  const manager = new RedisCacheManager();
  
  try {
    await manager.connect();

    switch (command) {
      case 'clear':
        if (option && ['queries', 'filters', 'sql'].includes(option)) {
          await manager.clearSpecificCache(option);
        } else {
          await manager.clearAllApplicationCache();
        }
        break;

      case 'inspect':
        await manager.inspectCache();
        break;

      case 'details':
        if (!option) {
          console.error('❌ Please provide a key pattern for details command');
          process.exit(1);
        }
        await manager.getKeyDetails(option);
        break;

      case 'warmup':
        await manager.warmUpFilterCache();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        await manager.showUsage();
        process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await manager.disconnect();
  }
}

main().catch(console.error); 