import OpenAI from 'openai';
import { getDatabase } from '../database/init.js';
import { logger } from '../utils/logger.js';

interface DashboardContext {
  filters: {
    start_date?: string;
    end_date?: string;
    merchant_id?: string;
    region?: string;
    tier?: string;
    am?: string;
    [key: string]: any;
  };
  cachedData: {
    [queryId: string]: {
      data: any[];
      metadata: {
        query_name: string;
        chart_hint: string;
        cached: boolean;
      };
    };
  };
}

interface MessageContext {
  userId: string;
  userRole: string;
  conversationId: string;
  dashboardContext?: DashboardContext;
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
  data?: any[];
  timestamp: string;
}

export class DashboardAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async processMessage(message: string, context: MessageContext): Promise<AgentResponse> {
    try {
      logger.agent('DashboardAgent: Processing dashboard-specific message');

      // Get agent prompt from database
      const db = getDatabase();
      const [rows] = await db.execute(
        'SELECT system_prompt FROM agent_prompts WHERE agent_name = ?',
        ['DashboardAgent']
      );

      let systemPrompt = (rows as any[])[0]?.system_prompt;
      
      // Fallback system prompt if not found in database
      if (!systemPrompt) {
        systemPrompt = `You are Bosta's dashboard assistant. You help users understand and analyze the data currently displayed on their dashboard. 

Your primary role is to:
1. Answer questions about the data shown in the current dashboard
2. Provide insights based on the cached query results
3. Reference the current filter selections when relevant
4. Only generate new queries if the cached data cannot answer the question

Always prioritize using the cached data from the dashboard before suggesting new queries.`;
      }

      // Build dashboard context information
      const dashboardInfo = this.buildDashboardContext(context.dashboardContext);
      
      // Build conversation context if available
      let conversationContext = '';
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        conversationContext = '\n\nConversation History:\n';
        context.conversationHistory.slice(-3).forEach((msg) => {
          conversationContext += `${msg.type === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        });
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}

${dashboardInfo}${conversationContext}

User role: ${context.userRole}

Instructions:
- Prioritize answering from the cached dashboard data shown above
- Reference current filter selections when relevant
- If cached data can answer the question, provide insights directly
- Only suggest new queries if the existing data cannot answer the question
- Be specific about which dashboard widgets/data you're referencing
`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.2,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, but I could not process your dashboard question.';

      // Check if we can answer from cached data
      const relevantData = this.extractRelevantCachedData(message, context.dashboardContext);

      return {
        content: response,
        data: relevantData,
        timestamp: new Date().toISOString(),
        agentUsed: 'DashboardAgent',
      };
    } catch (error) {
      logger.error('DashboardAgent error:', error);
      return {
        content: 'I apologize, but I encountered an error analyzing your dashboard data. Please try again.',
        timestamp: new Date().toISOString(),
        agentUsed: 'DashboardAgent',
      };
    }
  }

  private buildDashboardContext(dashboardContext?: DashboardContext): string {
    if (!dashboardContext) {
      return '\n\nNo dashboard context available.';
    }

    let context = '\n\nCURRENT DASHBOARD CONTEXT:\n';
    
    // Add filter information
    context += '\nActive Filters:\n';
    const filters = dashboardContext.filters;
    if (Object.keys(filters).length > 0) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          context += `- ${key}: ${value}\n`;
        }
      });
    } else {
      context += '- No filters applied\n';
    }

    // Add cached data information
    context += '\nAvailable Dashboard Data:\n';
    const cachedData = dashboardContext.cachedData;
    if (Object.keys(cachedData).length > 0) {
      Object.entries(cachedData).forEach(([queryId, queryResult]) => {
        context += `\n${queryResult.metadata.query_name} (${queryId}):\n`;
        context += `- Chart type: ${queryResult.metadata.chart_hint}\n`;
        context += `- Data rows: ${queryResult.data.length}\n`;
        context += `- Cached: ${queryResult.metadata.cached}\n`;
        
        // Add sample of data structure
        if (queryResult.data.length > 0) {
          const sampleRow = queryResult.data[0];
          context += `- Columns: ${Object.keys(sampleRow).join(', ')}\n`;
          
          // Add summary statistics for numeric columns
          const numericColumns = Object.keys(sampleRow).filter(key => 
            typeof sampleRow[key] === 'number'
          );
          
          if (numericColumns.length > 0) {
            context += `- Sample values:\n`;
            numericColumns.slice(0, 2).forEach(col => {
              const values = queryResult.data.map(row => row[col]).filter(val => typeof val === 'number');
              if (values.length > 0) {
                const sum = values.reduce((a, b) => a + b, 0);
                const avg = sum / values.length;
                context += `  - ${col}: avg ${avg.toFixed(2)}, total ${sum.toFixed(2)}\n`;
              }
            });
          }
        }
      });
    } else {
      context += '- No cached data available\n';
    }

    return context;
  }

  private extractRelevantCachedData(message: string, dashboardContext?: DashboardContext): any[] {
    if (!dashboardContext?.cachedData) {
      return [];
    }

    // Simple keyword matching to find relevant cached data
    const messageLower = message.toLowerCase();
    const keywords = ['revenue', 'volume', 'delivery', 'zone', 'merchant', 'daily', 'monthly'];
    
    let relevantData: any[] = [];
    
    Object.entries(dashboardContext.cachedData).forEach(([queryId, queryResult]) => {
      const queryNameLower = queryResult.metadata.query_name.toLowerCase();
      
      // Check if query name matches message keywords
      const hasRelevantKeyword = keywords.some(keyword => 
        messageLower.includes(keyword) && queryNameLower.includes(keyword)
      );
      
      if (hasRelevantKeyword) {
        relevantData = relevantData.concat(queryResult.data.slice(0, 10)); // Limit to 10 rows per query
      }
    });

    return relevantData;
  }
}