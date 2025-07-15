import express from 'express';
import { DashboardAgent } from '../agents/DashboardAgent.js';
import { getDatabase } from '../database/init.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message, filters, cachedData, conversationId } = req.body;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const db = getDatabase();
    
    // Ensure conversation exists for dashboard chat
    let convId = conversationId;
    if (!convId) {
      convId = uuidv4();
      await db.execute(
        'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)',
        [convId, userId, 'Dashboard Chat']
      );
    } else {
      // Check if the provided conversation ID exists and belongs to the user
      const [existingConv] = await db.execute(
        'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
        [convId, userId]
      );
      
      if (!(existingConv as any[]).length) {
        await db.execute(
          'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)',
          [convId, userId, 'Dashboard Chat']
        );
      }
    }

    // Save user message
    const userMessageId = uuidv4();
    await db.execute(
      'INSERT INTO messages (id, conversation_id, type, content) VALUES (?, ?, ?, ?)',
      [userMessageId, convId, 'user', message]
    );

    // Get conversation history for context (last 5 messages)
    const [historyRows] = await db.execute(`
      SELECT type, content, metadata, created_at
      FROM messages 
      WHERE conversation_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `, [convId]);
    
    const conversationHistory = (historyRows as any[])
      .reverse() // Restore chronological order
      .map(row => {
        let metadata = {};
        try {
          if (row.metadata) {
            metadata = JSON.parse(row.metadata);
          }
        } catch (error) {
          logger.warn('Failed to parse metadata:', row.metadata);
          metadata = {};
        }
        
        return {
          type: row.type,
          content: row.content,
          timestamp: row.created_at,
          ...metadata,
        };
      });

    // Process with dashboard agent
    const dashboardAgent = new DashboardAgent();
    const response = await dashboardAgent.processMessage(message, {
      userId,
      userRole,
      conversationId: convId,
      dashboardContext: {
        filters: filters || {},
        cachedData: cachedData || {}
      },
      conversationHistory,
    });

    // Save assistant response
    const assistantMessageId = uuidv4();
    await db.execute(
      'INSERT INTO messages (id, conversation_id, type, content, metadata) VALUES (?, ?, ?, ?, ?)',
      [assistantMessageId, convId, 'assistant', response.content, JSON.stringify({
        sql: response.sql,
        chart: response.chart,
        agentUsed: response.agentUsed,
        data: response.data,
      })]
    );

    // Log the interaction
    await db.execute(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, 'dashboard_chat', 'conversation', convId, JSON.stringify({
        prompt: message,
        agent: response.agentUsed,
        hasFilters: Object.keys(filters || {}).length > 0,
        hasCachedData: Object.keys(cachedData || {}).length > 0,
      })]
    );

    res.json({
      ...response,
      conversationId: convId
    });
  } catch (error) {
    logger.error('Dashboard chat error:', error);
    res.status(500).json({ 
      content: 'Sorry, I encountered an error analyzing your dashboard data. Please try again.',
      error: 'Internal server error' 
    });
  }
});

export default router;