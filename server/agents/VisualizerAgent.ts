import OpenAI from 'openai';
import { getDatabase } from '../database/init.js';
import { SQLTool } from '../tools/SQLTool.js';
import { MakeChartTool } from '../tools/MakeChartTool.js';
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

export class VisualizerAgent {
  private openai: OpenAI;
  private sqlTool: SQLTool;
  private makeChartTool: MakeChartTool;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.sqlTool = new SQLTool();
    this.makeChartTool = new MakeChartTool();
  }

  async processMessage(message: string, context: MessageContext): Promise<AgentResponse> {
    try {
      logger.agent('VisualizerAgent: Starting visualization generation');

      // Get agent prompt from database
      const db = getDatabase();
      const [rows] = await db.execute(
        'SELECT system_prompt FROM agent_prompts WHERE agent_name = ?',
        ['VisualizerAgent']
      );

      const systemPrompt = (rows as any[])[0]?.system_prompt ||
        'You are a data visualization specialist. Create charts and graphs to represent data clearly.';

      // First, get the data needed for visualization
      let sql: string | undefined;
      let chartUrl: string | undefined;
      let data: any[] = [];

      const needsData = await this.needsDataQuery(message, context);
      logger.info(`🔍 Needs data query: ${needsData}`);

      if (needsData) {
        logger.info('📊 Generating SQL query for visualization...');
        const sqlQuery = await this.generateSQLQuery(message, context);
        logger.info(`📝 Generated SQL: ${sqlQuery}`);

        if (sqlQuery) {
          const queryResult = await this.sqlTool.execute(sqlQuery, context);
          sql = sqlQuery;
          data = queryResult.data || [];
          logger.info(`✅ Query executed. Data rows: ${data.length}`);
        } else {
          logger.info('❌ No SQL query generated');
        }
      } else {
        // Check if we can reuse data from conversation history
        const lastMessageWithData = context.conversationHistory?.reverse().find(msg =>
          msg.sql && msg.agentUsed === 'VisualizerAgent'
        );

        if (lastMessageWithData?.sql) {
          logger.info('🔄 Reusing data from conversation history...');
          const queryResult = await this.sqlTool.execute(lastMessageWithData.sql, context);
          sql = lastMessageWithData.sql;
          data = queryResult.data || [];
          logger.info(`✅ Reused query executed. Data rows: ${data.length}`);
        }
      }

      // Generate chart if we have data
      if (data.length > 0) {
        logger.info('🎨 Generating chart specification...');
        const chartSpec = await this.generateChartSpec(message, data);
        logger.info('📋 Chart spec generated:', !!chartSpec);

        if (chartSpec) {
          logger.info('🖼️ Creating chart image...');
          try {
            chartUrl = await this.makeChartTool.createChart(chartSpec);
            logger.info('🎯 Chart created successfully:', !!chartUrl);
          } catch (chartError) {
            logger.error('💥 Chart creation failed:', chartError);
            // logger.error('📋 Failed chart spec:', JSON.stringify(chartSpec, null, 2));
            // Continue without chart rather than failing the entire request
            chartUrl = undefined;
          }
        } else {
          logger.warn('⚠️ No chart specification generated');
        }
      } else {
        logger.info('❌ No data available for chart generation');
      }

      // Generate response
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo-0125',
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}

You have access to data and can create visualizations. 
${data.length > 0 ? `Data retrieved: ${data.length} rows` : 'No data retrieved'}
${chartUrl ? 'Chart created successfully' : 'No chart created'}
${sql ? `\nACTUAL SQL EXECUTED: ${sql}` : ''}

${needsData ? 'NEW DATA was queried for this visualization.' : 'EXISTING DATA was reused from previous conversation for this chart type change.'}

When describing the visualization:
1. If EXISTING DATA was reused, explain that you're showing the same data in a different chart format
2. If NEW DATA was queried, explain what new data you retrieved
3. Always describe the actual data columns and insights based on the real data provided
4. Do NOT generate example SQL that differs from the actual SQL executed

Explain what the visualization shows and provide insights based on the actual data.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content || 'Visualization completed.';

      return {
        content: response,
        sql,
        chart: chartUrl,
        agentUsed: 'VisualizerAgent',
      };
    } catch (error) {
      logger.error('VisualizerAgent error:', error);
      return {
        content: 'I apologize, but I encountered an error creating the visualization. Please try again.',
        agentUsed: 'VisualizerAgent',
      };
    }
  }

  private async needsDataQuery(message: string, context: MessageContext): Promise<boolean> {
    // If there's no conversation history, we definitely need new data
    if (!context.conversationHistory || context.conversationHistory.length === 0) {
      return true;
    }

    // Check if there's any previous chart/visualization in the conversation
    const hasRecentVisualization = context.conversationHistory.some(msg =>
      msg.agentUsed === 'VisualizerAgent' && (msg.sql || msg.chart)
    );

    if (!hasRecentVisualization) {
      return true;
    }

    // Use AI to determine intent dynamically
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `Analyze the user's request in the context of the conversation to determine their intent.

CONVERSATION CONTEXT:
${context.conversationHistory.slice(-3).map(msg => {
  if (msg.type === 'user') {
    return `User: ${msg.content}`;
  } else {
    return `Assistant: ${msg.content}${msg.sql ? `\nSQL: ${msg.sql}` : ''}`;
  }
}).join('\n')}

USER'S CURRENT REQUEST: "${message}"

Determine if the user wants:
A) NEW DATA (new SQL query needed) - when asking for different data, metrics, time periods, filters, or businesses
B) SAME DATA (reuse existing data) - when asking to change chart type, style, or presentation of the same data

Respond with exactly "NEW_DATA" or "SAME_DATA" - nothing else.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.1,
        max_tokens: 10,
      });

      const intent = completion.choices[0]?.message?.content?.trim();
      logger.info(`🤖 AI Intent Analysis: ${intent}`);

      return intent === 'NEW_DATA';
    } catch (error) {
      logger.error('Intent analysis error:', error);
      // Fallback to true if AI analysis fails
      return true;
    }
  }

  private async generateSQLQuery(message: string, context: MessageContext): Promise<string | null> {
    try {

      // Get agent prompt from database
      const db = getDatabase();
      const [rows] = await db.execute(
        'SELECT system_prompt FROM agent_prompts WHERE agent_name = ?',
        ['VisualizerAgent']
      );

      const systemPrompt = (rows as any[])[0]?.system_prompt ||
        'You are a data visualization specialist. Create charts and graphs to represent data clearly.';

      // Build complete conversation context - let AI understand the references
      let conversationContext = '';

      if (context.conversationHistory && context.conversationHistory.length > 0) {
        conversationContext = '\n\nConversation History (use this to understand what the user is referring to):\n';

        context.conversationHistory.slice(-5).forEach((msg, _index) => {
          if (msg.type === 'user') {
            conversationContext += `User: ${msg.content}\n`;
          } else {
            conversationContext += `Assistant: ${msg.content}\n`;
            if (msg.sql) {
              conversationContext += `SQL executed: ${msg.sql}\n`;
            }
          }
        });

        conversationContext += `\nCurrent user message: ${message}\n`;
        conversationContext += '\nIMPORTANT: When the user says "this business" or similar, look at the conversation history above to identify the specific business name or entity they are referring to. Use the exact names found in the previous responses.\n';
      }


      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}${conversationContext}

CRITICAL MySQL SYNTAX REQUIREMENTS:
- Use DATE_FORMAT(created_at, '%Y-%m') for monthly grouping, NOT DATE_TRUNC
- Use DATE_FORMAT(created_at, '%Y') for yearly grouping  
- Use created_at column for dates, NOT delivery_date  
- Use BETWEEN dates instead of >= comparisons
- Generate MYSQL compatible syntax only

TIME PERIOD GROUPING RULES:
- "over the last X years" or "by year" or "yearly" or "per year" → GROUP BY YEAR(created_at) or DATE_FORMAT(created_at, '%Y')
- "monthly" or "by month" or "per month" → GROUP BY DATE_FORMAT(created_at, '%Y-%m')
- "daily" or "by day" or "per day" → GROUP BY DATE(created_at)
- Default for multi-year periods: Use yearly grouping unless specifically asked for monthly detail

Generate ONLY the SQL query, no explanations.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.1,
        max_tokens: 500,
      });

      const sqlQuery = completion.choices[0]?.message?.content?.trim();
      logger.info(`🤖 Raw SQL response: ${sqlQuery}`);

      // Extract SQL from markdown if present
      let cleanSqlQuery = sqlQuery;
      if (sqlQuery && sqlQuery.includes('```')) {
        const sqlMatch = sqlQuery.match(/```(?:sql|mysql)?\s*([\s\S]*?)\s*```/);
        if (sqlMatch) {
          cleanSqlQuery = sqlMatch[1].trim();
        }
      }

      logger.info(`🧹 Cleaned SQL query: ${cleanSqlQuery}`);
      logger.info(`🔍 SQL validation - starts with select: ${cleanSqlQuery?.toLowerCase().startsWith('select')}`);

      if (cleanSqlQuery && cleanSqlQuery.toLowerCase().startsWith('select')) {
        return cleanSqlQuery;
      }

      logger.info('❌ SQL validation failed');
      return null;
    } catch (error) {
      logger.error('SQL generation error:', error);
      return null;
    }
  }

  private async generateChartSpec(message: string, data: any[]): Promise<any> {
    try {
      // logger.info('📊 Chart generation - Input data:', JSON.stringify(data, null, 2));
      logger.info('📊 Chart generation - Data columns:', Object.keys(data[0] || {}));
      logger.info('📊 Chart generation - Number of rows:', data.length);

      if (data && data.length > 0) {
        
        // Validate that we have at least one column of data
        const firstRow = data[0];
        const keys = Object.keys(firstRow);
        if (keys.length === 0) {
          throw new Error('No data columns found');
        }
        
        // Create a corrected chart spec using only actual data
        const correctedSpec = {
          type: this.determineChartType(message, data),
          data: {
            labels: data.map(row => {
              // Use the first column as labels (usually month, business name, etc.)
              const firstKey = Object.keys(row)[0];
              const value = row[firstKey];
              // Ensure label is a readable string
              return value !== null && value !== undefined ? String(value) : 'Unknown';
            }),
            datasets: [{
              label: this.generateDatasetLabel(keys, data),
              data: data.map(row => {
                // Use the second column as data values (usually counts, amounts, etc.)
                const keys = Object.keys(row);
                const dataKey = keys[1] || keys[0];
                const value = row[dataKey];
                // Ensure data is numeric
                return typeof value === 'number' ? value : (parseFloat(value) || 0);
              }),
              backgroundColor: '#D71920',
              borderColor: '#D71920',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              datalabels: {
                display: true,
                anchor: 'end',
                align: 'top',
                formatter: (value: any) => value
              }
            },
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        };

        return correctedSpec;
      }

      return null;
    } catch (error) {
      logger.error('Chart spec generation error:', error);
      return null;
    }
  }

  private determineChartType(message: string, data: any[]): string {
    const lowerMessage = message.toLowerCase();
    
    // Check for specific chart type requests
    if (lowerMessage.includes('line') || lowerMessage.includes('trend') || 
        lowerMessage.includes('over time') || lowerMessage.includes('timeline')) {
      return 'line';
    }
    if (lowerMessage.includes('pie') || lowerMessage.includes('percentage') || 
        lowerMessage.includes('proportion') || lowerMessage.includes('share')) {
      return 'pie';
    }
    if (lowerMessage.includes('doughnut') || lowerMessage.includes('donut')) {
      return 'doughnut';
    }
    
    // Determine based on data characteristics
    if (data.length > 0) {
      const firstKey = Object.keys(data[0])[0];
      const firstValue = data[0][firstKey];
      
      // If first column looks like dates/months, prefer line chart
      if (typeof firstValue === 'string' && 
          (firstValue.match(/\d{4}-\d{2}/) || firstValue.includes('-') || 
           firstValue.match(/\d{4}/))) {
        return 'line';
      }
    }
    
    // Default to bar chart
    return 'bar';
  }

  private generateDatasetLabel(keys: string[], data: any[]): string {
    if (keys.length < 2) return 'Data';
    
    const dataColumn = keys[1];
    
    // Clean up column names to be more readable
    if (dataColumn.includes('count')) return 'Count';
    if (dataColumn.includes('total') || dataColumn.includes('amount')) return 'Total';
    if (dataColumn.includes('sum')) return 'Sum';
    if (dataColumn.includes('avg') || dataColumn.includes('average')) return 'Average';
    
    // Capitalize first letter and replace underscores
    return dataColumn.charAt(0).toUpperCase() + 
           dataColumn.slice(1).replace(/_/g, ' ');
  }
}
