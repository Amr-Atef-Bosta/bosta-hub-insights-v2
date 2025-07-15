import express from 'express';
import { getDatabase } from '../database/init.js';
import { SupervisorAgent } from '../agents/SupervisorAgent.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const db = getDatabase();
    
    // Ensure conversation exists
    let convId = conversationId;
    if (!convId) {
      // No conversation ID provided, create a new one
      convId = uuidv4();
      await db.execute(
        'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)',
        [convId, userId, 'New Conversation']
      );
    } else {
      // Check if the provided conversation ID exists and belongs to the user
      const [existingConv] = await db.execute(
        'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
        [convId, userId]
      );
      
      if (!(existingConv as any[]).length) {
        // Conversation doesn't exist, create it
        await db.execute(
          'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)',
          [convId, userId, 'New Conversation']
        );
      }
    }

    // Save user message
    const userMessageId = uuidv4();
    await db.execute(
      'INSERT INTO messages (id, conversation_id, type, content) VALUES (?, ?, ?, ?)',
      [userMessageId, convId, 'user', message]
    );

    // Get conversation history for context (last 10 messages to avoid token limits)
    const [historyRows] = await db.execute(`
      SELECT type, content, metadata, created_at
      FROM messages 
      WHERE conversation_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
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

    // Process with supervisor agent
    const supervisor = new SupervisorAgent();
    const response = await supervisor.processMessage(message, {
      userId,
      userRole,
      conversationId: convId,
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
      })]
    );

    // Log the interaction
    await db.execute(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, 'chat_message', 'conversation', convId, JSON.stringify({
        prompt: message,
        agent: response.agentUsed,
        hasSQL: !!response.sql,
        hasChart: !!response.chart,
      })]
    );

    res.json(response);
  } catch (error) {
    logger.error('Chat error:', error);
    res.status(500).json({ 
      content: 'Sorry, I encountered an error processing your request. Please try again.',
      error: 'Internal server error' 
    });
  }
});

router.get('/history/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = (req as any).user.userId;

    const db = getDatabase();
    const [rows] = await db.execute(`
      SELECT m.*, c.title 
      FROM messages m 
      JOIN conversations c ON m.conversation_id = c.id 
      WHERE m.conversation_id = ? AND c.user_id = ? 
      ORDER BY m.created_at ASC
    `, [conversationId, userId]);

    const messages = (rows as any[]).map(row => {
      let metadata = {};
      try {
        if (row.metadata) {
          metadata = JSON.parse(row.metadata);
        }
      } catch (error) {
        logger.warn('Failed to parse metadata in history:', row.metadata);
        metadata = {};
      }
      
      return {
        id: row.id,
        type: row.type,
        content: row.content,
        timestamp: row.created_at,
        ...metadata,
      };
    });

    res.json({
      conversationId,
      title: (rows as any[])[0]?.title || 'Conversation',
      messages,
    });
  } catch (_error) {
    logger.error('Chat history error:', _error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/validated-answer', async (req, res) => {
  try {
    const { question, scope } = req.body;
    const userRole = (req as any).user?.role;
    const userId = (req as any).user?.userId;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Import QueryAnswerAgent
    const { QueryAnswerAgent } = await import('../agents/QueryAnswerAgent.js');
    const queryAnswerAgent = new QueryAnswerAgent();

    // Process the question with the QueryAnswerAgent
    const response = await queryAnswerAgent.answerQuestion(question, scope || userRole?.toUpperCase());

    // Log the interaction
    if (userId) {
      const db = getDatabase();
      await db.execute(
        'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, 'validated_question', 'query_answer', 'validated', JSON.stringify({
          question,
          scope: scope || userRole?.toUpperCase(),
          confidence: response.confidence || 0
        })]
      );
    }

    res.json(response);
  } catch (error) {
    logger.error('Validated answer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/explain-source/:qid', async (req, res) => {
  try {
    const { qid } = req.params;
    const userId = (req as any).user?.userId;

    if (!qid) {
      return res.status(400).json({ error: 'Query ID is required' });
    }

    // Import QueryAnswerAgent
    const { QueryAnswerAgent } = await import('../agents/QueryAnswerAgent.js');
    const queryAnswerAgent = new QueryAnswerAgent();

    // Get explanation for the source query
    const response = await queryAnswerAgent.explainSource(qid);

    // Log the interaction
    if (userId) {
      const db = getDatabase();
      await db.execute(
        'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, 'explain_source', 'validated_query', qid, JSON.stringify({
          queryName: response.query?.name || 'Unknown'
        })]
      );
    }

    res.json(response);
  } catch (error) {
    logger.error('Explain source error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;