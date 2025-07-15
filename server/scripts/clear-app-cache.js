#!/usr/bin/env node

/**
 * Bosta Insights Hub - Application Cache Cleaner
 * 
 * This script clears only Redis keys related to this application,
 * not the entire Redis instance. Safe for use in staging/production.
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

async function clearApplicationCache() {
  const redisHost = process.env.REDIS_HOSTNAME || 'localhost';
  const redisPort = process.env.REDIS_PORT || '6379';
  const redisUrl = `redis://${redisHost}:${redisPort}`;
  
  console.log(`Connecting to Redis at ${redisUrl}...`);
  
  const redis = createClient({
    url: redisUrl
  });

  redis.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  try {
    await redis.connect();
    console.log('✅ Connected to Redis successfully');

    let totalKeysDeleted = 0;

    // Clear keys for each pattern
    for (const pattern of APPLICATION_KEY_PATTERNS) {
      console.log(`\nSearching for keys matching pattern: ${pattern}`);
      
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        console.log(`Found ${keys.length} keys to delete:`);
        keys.forEach(key => console.log(`  - ${key}`));
        
        await redis.del(keys);
        totalKeysDeleted += keys.length;
        console.log(`✅ Deleted ${keys.length} keys for pattern: ${pattern}`);
      } else {
        console.log(`No keys found for pattern: ${pattern}`);
      }
    }

    console.log(`\n🎉 Cache clearing completed!`);
    console.log(`Total keys deleted: ${totalKeysDeleted}`);
    
    // Show remaining key count for verification
    const remainingKeys = await redis.dbSize();
    console.log(`Remaining keys in Redis: ${remainingKeys}`);

  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    process.exit(1);
  } finally {
    await redis.disconnect();
    console.log('🔌 Disconnected from Redis');
  }
}

// Add command line options
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
Bosta Insights Hub - Application Cache Cleaner

Usage:
  node clear-app-cache.js [options]

Options:
  --dry-run, -d    Show what would be deleted without actually deleting
  --help, -h       Show this help message

Application Key Patterns:
  ${APPLICATION_KEY_PATTERNS.map(p => `- ${p}`).join('\n  ')}

Examples:
  node clear-app-cache.js                 # Clear all app cache keys
  node clear-app-cache.js --dry-run       # Show what would be deleted
  
Environment Variables:
  REDIS_HOSTNAME    Redis host (default: localhost)
  REDIS_PORT        Redis port (default: 6379)
`);
  process.exit(0);
}

async function dryRunCheck() {
  const redisHost = process.env.REDIS_HOSTNAME || 'localhost';
  const redisPort = process.env.REDIS_PORT || '6379';
  const redisUrl = `redis://${redisHost}:${redisPort}`;
  
  console.log(`🔍 DRY RUN - Connecting to Redis at ${redisUrl}...`);
  
  const redis = createClient({
    url: redisUrl
  });

  try {
    await redis.connect();
    console.log('✅ Connected to Redis successfully');

    let totalKeysFound = 0;

    for (const pattern of APPLICATION_KEY_PATTERNS) {
      console.log(`\nSearching for keys matching pattern: ${pattern}`);
      
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        console.log(`Found ${keys.length} keys that would be deleted:`);
        keys.forEach(key => console.log(`  - ${key}`));
        totalKeysFound += keys.length;
      } else {
        console.log(`No keys found for pattern: ${pattern}`);
      }
    }

    console.log(`\n📊 DRY RUN SUMMARY:`);
    console.log(`Total keys that would be deleted: ${totalKeysFound}`);
    
    const totalKeys = await redis.dbSize();
    console.log(`Total keys in Redis: ${totalKeys}`);
    console.log(`Keys that would remain: ${totalKeys - totalKeysFound}`);

  } catch (error) {
    console.error('❌ Error during dry run:', error);
    process.exit(1);
  } finally {
    await redis.disconnect();
  }
}

// Main execution
if (dryRun) {
  dryRunCheck().catch(console.error);
} else {
  clearApplicationCache().catch(console.error);
} 