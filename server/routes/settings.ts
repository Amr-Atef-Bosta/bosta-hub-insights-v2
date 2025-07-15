import express from 'express';
import { getDatabase } from '../database/init.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get all settings
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    
    // Get settings
    const [settingsRows] = await db.execute('SELECT setting_key, setting_value FROM settings');
    const settings: Record<string, any> = {};
    
    (settingsRows as any[]).forEach(row => {
      settings[row.setting_key] = JSON.parse(row.setting_value);
    });

    // Get table access patterns
    const [accessRows] = await db.execute('SELECT role, table_pattern FROM table_access ORDER BY role, table_pattern');
    const tableAccess: Record<string, string[]> = {};
    
    (accessRows as any[]).forEach(row => {
      if (!tableAccess[row.role]) {
        tableAccess[row.role] = [];
      }
      tableAccess[row.role].push(row.table_pattern);
    });

    res.json({
      pii_columns: settings.pii_columns || [],
      cache_ttl: settings.cache_ttl || 3600,
      feature_flags: settings.feature_flags || {
        whatsapp_enabled: false,
        dashboard_enabled: false,
        templates_enabled: false,
      },
      table_access: tableAccess,
    });
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update settings
router.put('/', async (req, res) => {
  try {
    const { pii_columns, cache_ttl, feature_flags, table_access } = req.body;
    const userId = (req as any).user.userId;

    const db = getDatabase();

    // Update settings
    if (pii_columns !== undefined) {
      await db.execute(
        'INSERT INTO settings (id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [uuidv4(), 'pii_columns', JSON.stringify(pii_columns), JSON.stringify(pii_columns)]
      );
    }

    if (cache_ttl !== undefined) {
      await db.execute(
        'INSERT INTO settings (id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [uuidv4(), 'cache_ttl', JSON.stringify(cache_ttl), JSON.stringify(cache_ttl)]
      );
    }

    if (feature_flags !== undefined) {
      await db.execute(
        'INSERT INTO settings (id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [uuidv4(), 'feature_flags', JSON.stringify(feature_flags), JSON.stringify(feature_flags)]
      );
    }

    // Update table access
    if (table_access !== undefined) {
      // Clear existing access patterns
      await db.execute('DELETE FROM table_access');
      
      // Insert new patterns
      for (const [role, patterns] of Object.entries(table_access)) {
        for (const pattern of patterns as string[]) {
          await db.execute(
            'INSERT INTO table_access (id, role, table_pattern) VALUES (?, ?, ?)',
            [uuidv4(), role, pattern]
          );
        }
      }
    }

    // Log the action
    await db.execute(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, 'update_settings', 'settings', null, JSON.stringify({
        updatedPII: pii_columns !== undefined,
        updatedCache: cache_ttl !== undefined,
        updatedFlags: feature_flags !== undefined,
        updatedAccess: table_access !== undefined,
      })]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;