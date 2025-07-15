import express from 'express';
import { getDatabase } from '../database/init.js';
import { ConnectorService } from '../services/ConnectorService.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get all connectors
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const [rows] = await db.execute('SELECT * FROM connectors ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    logger.error('Get connectors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create connector
router.post('/', async (req, res) => {
  try {
    const { name, kind, conn_uri, schema_json } = req.body;
    const userId = (req as any).user.userId;

    if (!name || !kind || !conn_uri) {
      return res.status(400).json({ error: 'Name, kind, and connection URI are required' });
    }

    const connectorId = uuidv4();
    const db = getDatabase();
    
    await db.execute(
      'INSERT INTO connectors (id, name, kind, conn_uri, schema_json) VALUES (?, ?, ?, ?, ?)',
      [connectorId, name, kind, conn_uri, schema_json || null]
    );

    // Log the action
    await db.execute(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, 'create_connector', 'connector', connectorId, JSON.stringify({ name, kind })]
    );

    const [rows] = await db.execute('SELECT * FROM connectors WHERE id = ?', [connectorId]);
    res.status(201).json((rows as any[])[0]);
  } catch (error) {
    logger.error('Create connector error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update connector
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, kind, conn_uri, schema_json } = req.body;
    const userId = (req as any).user.userId;

    const db = getDatabase();
    
    await db.execute(
      'UPDATE connectors SET name = ?, kind = ?, conn_uri = ?, schema_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, kind, conn_uri, schema_json || null, id]
    );

    // Log the action
    await db.execute(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, 'update_connector', 'connector', id, JSON.stringify({ name, kind })]
    );

    const [rows] = await db.execute('SELECT * FROM connectors WHERE id = ?', [id]);
    res.json((rows as any[])[0]);
  } catch (error) {
    logger.error('Update connector error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete connector
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const db = getDatabase();
    
    await db.execute('DELETE FROM connectors WHERE id = ?', [id]);

    // Log the action
    await db.execute(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, 'delete_connector', 'connector', id, JSON.stringify({})]
    );

    res.status(204).send();
  } catch (error) {
    logger.error('Delete connector error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test connection
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = getDatabase();
    const [rows] = await db.execute('SELECT * FROM connectors WHERE id = ?', [id]);
    const connector = (rows as any[])[0];

    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    const connectorService = new ConnectorService();
    const result = await connectorService.testConnection(connector);

    res.json(result);
  } catch (error) {
    logger.error('Test connection error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Connection test failed' 
    });
  }
});

export default router;