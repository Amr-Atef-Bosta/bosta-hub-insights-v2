import OpenAI from 'openai';
import { AnalystAgent } from './AnalystAgent.js';
import { VisualizerAgent } from './VisualizerAgent.js';
import { ForecasterAgent } from './ForecasterAgent.js';
import { logger } from '../utils/logger.js';

interface MessageContext {
  userId: string;
  userRole: string;
  conversationId: string;
  conversationHistory?: Array<{
    type: string;
    content: string;
    timestamp: Date;
    sql?: string;
    chart?: string;
    agentUsed?: string;
  }>;
}

interface AgentResponse {
  content: string;
  sql?: string;
  chart?: string;
  agentUsed: string;
}

export class SupervisorAgent {
  private openai: OpenAI;
  private analystAgent: AnalystAgent;
  private visualizerAgent: VisualizerAgent;
  private forecasterAgent: ForecasterAgent;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.analystAgent = new AnalystAgent();
    this.visualizerAgent = new VisualizerAgent();
    this.forecasterAgent = new ForecasterAgent();
  }

  async processMessage(message: string, context: MessageContext): Promise<AgentResponse> {
    try {
      // Determine which agent should handle this request
      const routingDecision = await this.routeMessage(message, context);
      
      switch (routingDecision.agent) {
        case 'analyst':
          return await this.analystAgent.processMessage(message, context);
        
        case 'visualizer':
          return await this.visualizerAgent.processMessage(message, context);
        
        case 'forecaster':
          return await this.forecasterAgent.processMessage(message, context);
        
        default:
          return await this.analystAgent.processMessage(message, context);
      }
    } catch (error) {
      logger.error('SupervisorAgent error:', error);
      return {
        content: 'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.',
        agentUsed: 'SupervisorAgent',
      };
    }
  }

  private async routeMessage(message: string, context: MessageContext): Promise<{ agent: string; reasoning: string }> {
    try {
      // Use AI to dynamically determine the best agent based on user intent
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `You are a routing agent for Bosta's logistics analytics system. Analyze the user's message and conversation context to determine which specialist agent should handle it:

AVAILABLE AGENTS:
- "analyst": For data queries, SQL analysis, general questions about logistics data, business insights, delivery metrics
- "visualizer": For requests asking for charts, graphs, plots, visualizations, or any visual representations of data
- "forecaster": For predictions, trends, forecasting, time-series analysis, or future projections

CONVERSATION CONTEXT:
${context.conversationHistory?.slice(-3).map(msg => {
  if (msg.type === 'user') {
    return `User: ${msg.content}`;
  } else {
    return `Assistant: ${msg.content.substring(0, 100)}...${msg.agentUsed ? ` [${msg.agentUsed}]` : ''}`;
  }
}).join('\n') || 'No previous conversation'}

USER MESSAGE: "${message}"
USER ROLE: ${context.userRole}

ROUTING GUIDELINES:
- Consider the user's primary intent, not just keywords
- If user wants to see data in visual form → visualizer
- If user wants predictions or future analysis → forecaster  
- For data analysis, insights, or general queries → analyst
- Consider conversation flow - if they're already working with charts, chart-related requests go to visualizer

Respond with JSON: {"agent": "analyst|visualizer|forecaster", "reasoning": "brief explanation of why this agent was chosen"}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const response = completion.choices[0]?.message?.content;
      logger.info(`🤖 AI routing response: ${response}`);
      
      if (response) {
        try {
          const parsed = JSON.parse(response);
          logger.info(`✅ Routing decision: ${JSON.stringify(parsed)}`);
          return parsed;
        } catch (_parseError) {
          logger.error('❌ Failed to parse routing response, using fallback');
          // Intelligent fallback based on response content
          if (response.includes('visualizer') || response.includes('chart') || response.includes('graph')) {
            return { agent: 'visualizer', reasoning: 'Visual request detected in fallback analysis' };
          }
          if (response.includes('forecaster') || response.includes('predict') || response.includes('forecast')) {
            return { agent: 'forecaster', reasoning: 'Forecasting request detected in fallback analysis' };
          }
        }
      }

      logger.warn('⚠️ Using default routing to analyst');
      return { agent: 'analyst', reasoning: 'Default to analyst due to routing uncertainty' };
    } catch (error) {
      logger.error('💥 Routing error:', error);
      return { agent: 'analyst', reasoning: 'Error in routing, defaulting to analyst' };
    }
  }
}