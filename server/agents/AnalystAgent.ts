import OpenAI from 'openai';
import { getDatabase } from '../database/init.js';
import { SQLTool } from '../tools/SQLTool.js';
import { MaskPIITool } from '../tools/MaskPIITool.js';
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
  data: any[];
  timestamp: string;
}

export class AnalystAgent {
  private sqlTool: SQLTool;
  private maskPIITool: MaskPIITool;
  private openai: OpenAI;

  constructor() {
    this.sqlTool = new SQLTool();
    this.maskPIITool = new MaskPIITool();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async processMessage(message: string, context: MessageContext): Promise<AgentResponse> {
    try {
      logger.agent('AnalystAgent: Processing message');

      // Get agent prompt from database
      const db = getDatabase();
      const [rows] = await db.execute(
        'SELECT system_prompt FROM agent_prompts WHERE agent_name = ?',
        ['AnalystAgent']
      );

      const systemPrompt = (rows as any[])[0]?.system_prompt ||
        'You are Bosta\'s logistics data analyst. Analyze data and provide insights about logistics operations.';

      // Build conversation context if available
      let conversationContext = '';
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        conversationContext = '\n\nConversation History (for context):\n';
        context.conversationHistory.slice(-5).forEach((msg, index) => {
          conversationContext += `${msg.type === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
          if (msg.sql) {
            conversationContext += `SQL: ${msg.sql}\n`;
          }
        });
        conversationContext += '\nPlease use this conversation history to understand context and references like "that business", "those deliveries", etc.\n';
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}${conversationContext}

Available tools:
- SQLTool: Execute SQL queries against connected databases
- MaskPIITool: Mask PII data based on user role

User role: ${context.userRole}

If the user is not an admin and the data contains PII columns, use MaskPIITool to protect sensitive information.
`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.1,
        max_tokens: 1500,
      });

      let response = completion.choices[0]?.message?.content || 'I apologize, but I could not process your request.';
      let sql: string | undefined;
      let data: any[] = [];

      // Check if the user explicitly requested NOT to run queries
      if (!this.shouldSkipDataQuery(message)) {
        logger.info(`🔍 Attempting to find and execute SQL query for message: ${message}`);

        // First, try to extract SQL from the initial response
        let sqlQuery = this.extractSQLFromResponse(response);

        // If no SQL found in response, try to generate one separately
        if (!sqlQuery) {
          logger.info('🤖 No SQL found in response, generating separately...');
          sqlQuery = await this.generateSQLQuery(message, context);
        } else {
          logger.info(`🔍 Found SQL in initial response: ${sqlQuery}`);
        }

        if (sqlQuery) {
          try {
            const queryResult = await this.sqlTool.execute(sqlQuery, context);
            logger.info(`✅ Query executed successfully. Rows: ${queryResult.rowCount}`);
            sql = sqlQuery;
            data = queryResult.data || [];

            // Mask PII if user is not admin
            let processedData = data;
            if (context.userRole !== 'admin' && data) {
              processedData = await this.maskPIITool.maskData(data, context.userRole);
            }

            // Generate response with data
            response = await this.generateResponseWithData(message, sqlQuery, processedData);
          } catch (error) {
            const err = error as Error;
            logger.error('💥 SQL execution error:', err);
            logger.error(`Error details: message=${err.message}, stack=${err.stack}, name=${err.name}`);
            // Don't override response with error for non-data queries
            logger.info('ℹ️  Continuing with original response due to SQL error');
          }
        } else {
          logger.info('❌ No SQL query found or generated - using original response');
        }
      } else {
        logger.info('ℹ️  Skipping data query as explicitly requested by user');
      }

      return {
        content: response,
        sql,
        data,
        timestamp: new Date().toISOString(),
        agentUsed: 'AnalystAgent',
      };
    } catch (error) {
      logger.error('AnalystAgent error:', error);
      return {
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        sql: undefined,
        data: [],
        timestamp: new Date().toISOString(),
        agentUsed: 'AnalystAgent',
      };
    }
  }

  private shouldSkipDataQuery(message: string): boolean {
    const skipPhrases = [
      'without running queries',
      'without querying',
      'don\'t run queries',
      'don\'t query',
      'no queries',
      'skip queries',
      'just explain',
      'explain only',
      'theory only',
      'conceptual only'
    ];

    return skipPhrases.some(phrase =>
      message.toLowerCase().includes(phrase)
    );
  }

  private extractSQLFromResponse(response: string): string | null {
    const sqlMatch = response.match(/```(?:sql)?\s*([\s\S]*?)\s*```/);
    if (sqlMatch) {
      const sql = sqlMatch[1].trim();
      // Basic validation - should start with SELECT
      if (sql.toLowerCase().startsWith('select')) {
        return sql;
      }
    }
    return null;
  }

  private async generateSQLQuery(message: string, context: MessageContext): Promise<string | null> {
    try {
      logger.agent('AnalystAgent conversation history:', JSON.stringify(context.conversationHistory, null, 2));

      logger.info(`🤖 Generating SQL for message: ${message}`);
      logger.info(`👤 User role: ${context.userRole}`);

      // Build conversation context for SQL generation
      let conversationContext = '';
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        conversationContext = '\n\nRecent conversation context:\n';
        context.conversationHistory.slice(-3).forEach((msg, _index) => {
          if (msg.type === 'user') {
            conversationContext += `User asked: ${msg.content}\n`;
          } else if (msg.sql) {
            conversationContext += `Previous SQL query: ${msg.sql}\n`;
          }
        });
        conversationContext += '\nUse this context to understand references like "that business", "those customers", etc.\n';
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `You are a SQL expert for Bosta logistics database. Generate SQL queries based on user requests.${conversationContext}

User role: ${context.userRole}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.1,
        max_tokens: 500,
      });

      logger.info('🎯 OpenAI completion received');
      let sqlQuery = completion.choices[0]?.message?.content?.trim();
      logger.info(`📋 Raw SQL response: ${sqlQuery}`);

      // Extract SQL from markdown code blocks if present
      if (sqlQuery && sqlQuery.includes('```')) {
        const sqlMatch = sqlQuery.match(/```(?:sql)?\s*([\s\S]*?)\s*```/);
        if (sqlMatch) {
          sqlQuery = sqlMatch[1].trim();
          logger.info(`🔧 Extracted SQL from code blocks: ${sqlQuery}`);
        }
      }

      // Basic validation
      if (sqlQuery && sqlQuery.toLowerCase().startsWith('select')) {
        logger.info('✅ SQL query validated successfully');
        return sqlQuery;
      }

      logger.info(`❌ SQL validation failed: hasContent=${!!sqlQuery}, startsWithSelect=${sqlQuery ? sqlQuery.toLowerCase().startsWith('select') : false}, firstChars=${sqlQuery ? sqlQuery.substring(0, 20) : 'null'}`);
      return null;
    } catch (error) {
      logger.error('💥 SQL generation error:', error);
      return null;
    }
  }

  private async generateResponseWithData(message: string, sql: string, data: any[]): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `You are Bosta's data analyst. Analyze the query results and provide a concise summary.

Provide ONLY a summary section that explains what the data shows in a clear and direct manner.

Format:
### Summary
[Your analysis of what the data reveals]

Be concise and focus on the key findings without additional sections or recommendations.`
          },
          {
            role: 'user',
            content: `User asked: "${message}"

SQL query executed:
\`\`\`sql
${sql}
\`\`\`

Query results:
${JSON.stringify(data.slice(0, 10), null, 2)}

${data.length > 10 ? `... and ${data.length - 10} more rows` : ''}

Please provide a summary of what this data shows.`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      return completion.choices[0]?.message?.content || 'Analysis completed.';
    } catch (error) {
      logger.error('Response generation error:', error);
      return `Query executed successfully. Found ${data.length} results.\n\n\`\`\`sql\n${sql}\n\`\`\``;
    }
  }
}
