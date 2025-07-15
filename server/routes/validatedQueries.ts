import express from 'express';
import { ValidatedQueriesService } from '../services/validatedQueries.js';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/init.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const validatedQueriesService = new ValidatedQueriesService();

// Get all validated queries
router.get('/', async (req, res) => {
  try {
    const { scope } = req.query;
    const queries = await validatedQueriesService.getValidatedQueries(scope as string);
    res.json(queries);
  } catch (error) {
    logger.error('Get validated queries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific validated query
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = await validatedQueriesService.getValidatedQueryByIdOrName(id);
    
    if (!query) {
      return res.status(404).json({ error: 'Validated query not found' });
    }
    
    res.json(query);
  } catch (error) {
    logger.error('Get validated query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new validated query
router.post('/', async (req, res) => {
  try {
    const { name, scope, sql_text, chart_hint, validated_by } = req.body;
    const userId = (req as any).user?.userId;

    if (!name || !scope || !sql_text || !validated_by) {
      return res.status(400).json({ 
        error: 'Name, scope, SQL text, and validated_by are required' 
      });
    }

    const queryData = {
      name,
      scope,
      sql_text,
      chart_hint: chart_hint || 'auto',
      validated_by,
      validated_at: new Date(),
      active: true
    };

    const queryId = await validatedQueriesService.createValidatedQuery(queryData);

    // Log the action for audit
    if (userId) {
      const db = getDatabase();
      await db.execute(
        'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, 'create_validated_query', 'validated_query', queryId, JSON.stringify({ name, scope })]
      );
    }

    const createdQuery = await validatedQueriesService.getValidatedQuery(queryId);
    res.status(201).json(createdQuery);
  } catch (error) {
    logger.error('Create validated query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update validated query
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = (req as any).user?.userId;

    // First get the query to get the actual UUID if a name was provided
    const existingQuery = await validatedQueriesService.getValidatedQueryByIdOrName(id);
    if (!existingQuery) {
      return res.status(404).json({ error: 'Validated query not found' });
    }

    await validatedQueriesService.updateValidatedQuery(existingQuery.id, updateData);

    // Log the action for audit
    if (userId) {
      const db = getDatabase();
      await db.execute(
        'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, 'update_validated_query', 'validated_query', existingQuery.id, JSON.stringify(updateData)]
      );
    }

    const updatedQuery = await validatedQueriesService.getValidatedQuery(existingQuery.id);
    res.json(updatedQuery);
  } catch (error) {
    logger.error('Update validated query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Execute validated query with filters
router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const filters = req.body.filters || {};
    
    // Get the validated query metadata first
    const validatedQuery = await validatedQueriesService.getValidatedQueryByIdOrName(id);
    if (!validatedQuery) {
      return res.status(404).json({ error: 'Validated query not found' });
    }
    
    const result = await validatedQueriesService.executeValidatedQuery(id, filters);
    res.json({
      data: result.data,
      metadata: {
        is_validated: true,
        query_id: validatedQuery.id,
        query_name: validatedQuery.name,
        chart_hint: validatedQuery.chart_hint,
        scope: validatedQuery.scope,
        filters_applied: filters,
        cached: result.cached
      }
    });
  } catch (error) {
    logger.error('Execute validated query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test SQL query (for admin interface)
router.post('/test', async (req, res) => {
  try {
    const { sql, filters } = req.body;
    
    if (!sql) {
      return res.status(400).json({ error: 'SQL query is required' });
    }

    const result = await validatedQueriesService.testQuery(sql, filters || {});
    res.json(result);
  } catch (error) {
    logger.error('Test query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get filter dimensions
router.get('/meta/filters', async (req, res) => {
  try {
    const dimensions = await validatedQueriesService.getFilterDimensions();
    res.json(dimensions);
  } catch (error) {
    logger.error('Get filter dimensions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get filter options for a specific filter
router.get('/meta/filters/:param/options', async (req, res) => {
  try {
    const { param } = req.params;
    const options = await validatedQueriesService.getFilterOptions(param);
    res.json(options);
  } catch (error) {
    logger.error('Get filter options error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Warm up filter options cache
router.post('/meta/filters/cache/warmup', async (req, res) => {
  try {
    await validatedQueriesService.warmUpFilterCache();
    res.json({ message: 'Filter cache warm-up completed' });
  } catch (error) {
    logger.error('Filter cache warm-up error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Invalidate filter options cache
router.delete('/meta/filters/cache/:param?', async (req, res) => {
  try {
    const { param } = req.params;
    await validatedQueriesService.invalidateFilterCache(param);
    const message = param 
      ? `Filter cache invalidated for ${param}` 
      : 'All filter caches invalidated';
    res.json({ message });
  } catch (error) {
    logger.error('Filter cache invalidation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Materialize all queries (for admin/cron)
router.post('/materialize', async (req, res) => {
  try {
    const userRole = (req as any).user?.role;
    
    // Only admin users can trigger materialization
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await validatedQueriesService.materializeAllQueries();
    res.json({ message: 'All validated queries materialized successfully' });
  } catch (error) {
    logger.error('Materialize queries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate validated query
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    // First get the query to get the actual UUID if a name was provided
    const existingQuery = await validatedQueriesService.getValidatedQueryByIdOrName(id);
    if (!existingQuery) {
      return res.status(404).json({ error: 'Validated query not found' });
    }

    await validatedQueriesService.updateValidatedQuery(existingQuery.id, { active: false });

    // Log the action for audit
    if (userId) {
      const db = getDatabase();
      await db.execute(
        'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, 'deactivate_validated_query', 'validated_query', existingQuery.id, JSON.stringify({ active: false })]
      );
    }

    res.json({ message: 'Validated query deactivated successfully' });
  } catch (error) {
    logger.error('Deactivate validated query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 