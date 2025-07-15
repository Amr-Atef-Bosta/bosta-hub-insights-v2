# Cache Management for Bosta Insights Hub

This document explains how to manage Redis cache for the Bosta Insights Hub application without affecting other applications sharing the same Redis instance.

## Overview

The application uses Redis for caching with the following key patterns:

- `validated_query:*` - Cached query results (24h TTL)
- `filter_options:*` - Cached filter options (12h TTL)  
- `query:*` - SQL tool query cache (1h TTL)

## Quick Commands

### Clear All Application Cache
```bash
npm run cache:clear
```

### Dry Run (See What Would Be Deleted)
```bash
npm run cache:dry-run
```

### Inspect Current Cache
```bash
npm run redis:inspect
```

## Advanced Redis Management

### Clear Specific Cache Types
```bash
# Clear only validated query results
npm run redis:clear:queries

# Clear only filter options
npm run redis:clear:filters

# Clear only SQL tool cache
npm run redis:clear:sql
```

### Warm Up Filter Cache
```bash
npm run redis:warmup
```

### Manual Redis Manager Usage

The `redis-manager.js` script provides comprehensive cache management:

```bash
# Show all available commands
node server/scripts/redis-manager.js help

# Clear specific cache types
node server/scripts/redis-manager.js clear queries
node server/scripts/redis-manager.js clear filters
node server/scripts/redis-manager.js clear sql

# Inspect cache statistics
node server/scripts/redis-manager.js inspect

# Get detailed information about specific keys
node server/scripts/redis-manager.js details "validated_query:*"
node server/scripts/redis-manager.js details "filter_options:*"

# Warm up filter cache
node server/scripts/redis-manager.js warmup
```

## Safety Features

✅ **Safe for Production/Staging**: These tools only clear application-specific keys, never the entire Redis instance

✅ **Dry Run Support**: Test operations before executing them

✅ **Detailed Reporting**: See exactly what keys will be affected

✅ **Pattern-Based**: Uses specific key patterns to avoid affecting other applications

## Common Use Cases

### Development Reset
When you need to clear cache during development:
```bash
npm run cache:clear
```

### Filter Data Changes
When filter source data changes and you need to refresh filter options:
```bash
npm run redis:clear:filters
npm run redis:warmup
```

### Query Logic Updates
When validated query logic changes:
```bash
npm run redis:clear:queries
```

### Production Cache Refresh
For selective cache clearing in production:
```bash
# First inspect what exists
npm run redis:inspect

# Clear specific cache type if needed
npm run redis:clear:queries

# Warm up filter cache to improve performance
npm run redis:warmup
```

## Environment Variables

The scripts use the same Redis configuration as the application:

- `REDIS_HOSTNAME` (default: localhost)
- `REDIS_PORT` (default: 6379)

## Monitoring

### Check Cache Hit Rates
Use the inspect command to monitor cache usage:
```bash
npm run redis:inspect
```

This shows:
- Number of keys per cache type
- Sample key names
- Total vs application-specific key counts

### Memory Usage
For detailed memory usage of specific keys:
```bash
node server/scripts/redis-manager.js details "validated_query:*"
```

## Troubleshooting

### Connection Issues
If you get Redis connection errors:
1. Check that Redis is running
2. Verify `REDIS_HOSTNAME` and `REDIS_PORT` in your `.env` file
3. Ensure network connectivity to Redis instance

### Permission Issues
If you get permission errors:
```bash
chmod +x server/scripts/clear-app-cache.js
chmod +x server/scripts/redis-manager.js
```

### Cache Not Clearing
If cache doesn't seem to clear:
1. Run `npm run redis:inspect` to verify current state
2. Check the key patterns match what's actually in Redis
3. Ensure you're connected to the correct Redis instance

## Integration with Application

The cache management tools are integrated with the application's existing cache infrastructure:

- Uses the same Redis connection configuration
- Respects the same key naming patterns
- Compatible with automatic cache warm-up on server startup
- Works with the periodic cache refresh (every 6 hours)

## Scripts Location

- Main clear script: `server/scripts/clear-app-cache.js`
- Advanced manager: `server/scripts/redis-manager.js`
- NPM scripts: Defined in `package.json` 