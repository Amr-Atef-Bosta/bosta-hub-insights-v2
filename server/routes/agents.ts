import express from 'express';
import { getDatabase } from '../database/init.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get all agents
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const [rows] = await db.execute(`
      SELECT id, agent_name, system_prompt, model, tools, updated_at 
      FROM agent_prompts 
      ORDER BY agent_name
    `);

    const agents = (rows as any[]).map(row => ({
      ...row,
      tools: JSON.parse(row.tools || '[]'),
    }));

    res.json(agents);
  } catch (error) {
    logger.error('Get agents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update agent prompt
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { system_prompt } = req.body;
    const userId = (req as any).user.userId;

    if (!system_prompt) {
      return res.status(400).json({ error: 'System prompt is required' });
    }

    const db = getDatabase();
    
    await db.execute(
      'UPDATE agent_prompts SET system_prompt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [system_prompt, id]
    );

    // Log the action
    await db.execute(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, 'update_agent_prompt', 'agent', id, JSON.stringify({ promptLength: system_prompt.length })]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Update agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset agent prompt to default
router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const db = getDatabase();
    
    // Get agent name first
    const [agentRows] = await db.execute('SELECT agent_name FROM agent_prompts WHERE id = ?', [id]);
    const agent = (agentRows as any[])[0];

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get default prompt based on agent name
    const defaultPrompts: Record<string, string> = {
      'AnalystAgent': 'You are Bosta\'s logistics data analyst. Mission: make MENA last-mile deliveries seamless and transparent. If the requested column is tagged as PII and user role ≠ admin, mask it or refuse. Always return the SQL you executed in a markdown code-block. Be concise but thorough in your analysis.',
      'VisualizerAgent': 'You are a data visualization specialist for Bosta logistics. Create clear, compelling charts and graphs that tell the story of the data. Focus on logistics KPIs like delivery rates, order volumes, and performance metrics. Always explain what the visualization shows and key insights.',
      'ForecasterAgent': 'You are a forecasting expert for Bosta logistics operations. Analyze time-series data to predict trends in orders, deliveries, and operational metrics. Provide confidence intervals and explain your methodology. Focus on actionable insights for logistics planning.',
      'AMCopilotAgent': 'You are an Account Manager copilot for Bosta. Help AMs understand client performance, identify opportunities, and draft communications. Focus on client-specific metrics, delivery performance, and relationship insights. Always maintain a professional, client-focused tone.',
      'SupervisorAgent': 'You are the supervisor agent that routes user queries to the most appropriate specialist agent. Analyze the user\'s request and determine whether it needs data analysis, visualization, forecasting, or AM support. Route accordingly and provide context to the selected agent.',
    };

    const defaultPrompt = defaultPrompts[agent.agent_name] || 'Default system prompt for this agent.';

    await db.execute(
      'UPDATE agent_prompts SET system_prompt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [defaultPrompt, id]
    );

    // Log the action
    await db.execute(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, 'reset_agent_prompt', 'agent', id, JSON.stringify({ agentName: agent.agent_name })]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Reset agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;