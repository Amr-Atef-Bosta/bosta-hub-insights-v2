import OpenAI from 'openai';
import { getDatabase } from '../database/init.js';
import { SQLTool } from '../tools/SQLTool.js';
import { ForecastTool } from '../tools/ForecastTool.js';
import { logger } from '../utils/logger.js';

interface MessageContext {
  userId: string;
  userRole: string;
  conversationId: string;
}

interface AgentResponse {
  content: string;
  sql?: string;
  chart?: string;
  agentUsed: string;
}

export class ForecasterAgent {
  private openai: OpenAI;
  private sqlTool: SQLTool;
  private forecastTool: ForecastTool;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.sqlTool = new SQLTool();
    this.forecastTool = new ForecastTool();
  }

  async processMessage(message: string, context: MessageContext): Promise<AgentResponse> {
    try {
      // Get agent prompt from database
      const db = getDatabase();
      const [rows] = await db.execute(
        'SELECT system_prompt FROM agent_prompts WHERE agent_name = ?',
        ['ForecasterAgent']
      );

      const systemPrompt = (rows as any[])[0]?.system_prompt || 
        'You are a forecasting expert. Analyze time-series data and provide predictions.';

      let sql: string | undefined;
      let chartUrl: string | undefined;

      // Get time-series data for forecasting
      if (await this.needsTimeSeriesData(message, context)) {
        const sqlQuery = await this.generateSQLQuery(message, context);
        if (sqlQuery) {
          const queryResult = await this.sqlTool.execute(sqlQuery, context);
          sql = sqlQuery;
          
          if (queryResult.data && queryResult.data.length > 0) {
            const forecastResult = await this.forecastTool.generateForecast(queryResult.data);
            if (forecastResult.chartUrl) {
              chartUrl = forecastResult.chartUrl;
            }
          }
        }
      }

      // Generate response
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}

${chartUrl ? 'Forecast chart generated successfully.' : 'No forecast chart created.'}
Provide insights about trends and predictions.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.3,
        max_tokens: 1200,
      });

      const response = completion.choices[0]?.message?.content || 'Forecast analysis completed.';

      return {
        content: response,
        sql,
        chart: chartUrl,
        agentUsed: 'ForecasterAgent',
      };
    } catch (error) {
      logger.error('ForecasterAgent error:', error);
      return {
        content: 'I apologize, but I encountered an error generating the forecast. Please try again.',
        agentUsed: 'ForecasterAgent',
      };
    }
  }

  private async needsTimeSeriesData(message: string, _context: MessageContext): Promise<boolean> {
    try {
      // Use AI to dynamically determine if the request requires time series data for forecasting
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `Analyze the user's request to determine if it requires time series data for forecasting analysis.

CONTEXT:
- User message: "${message}"
- This is a forecasting agent that specializes in predictions, trends, and time-based analysis

DETERMINE:
Does this request require historical time series data to make predictions or analyze trends?

Consider:
- Requests for predictions, forecasts, trends, growth patterns
- Time-based analysis (monthly, weekly, seasonal patterns)
- Future projections based on historical data
- Trend analysis and pattern recognition
- Any request that needs historical data to predict future outcomes

Respond with exactly "YES" if time series data is needed, or "NO" if not.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.1,
        max_tokens: 5,
      });

      const response = completion.choices[0]?.message?.content?.trim().toUpperCase();
      logger.info(`🤖 Time series data analysis: ${response}`);
      
      return response === 'YES';
    } catch (error) {
      logger.error('Time series analysis error:', error);
      // Fallback to true for safety - if we can't determine, assume we need data
      return true;
    }
  }

  private async generateSQLQuery(message: string, _context: MessageContext): Promise<string | null> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `Generate SQL query for forecasting data analysis. Focus on time-series data.

PRIMARY VIEW: new_deliveries_dashboard_cdc (comprehensive delivery view with all related data)

This view contains all delivery information with proper joins:

Main delivery fields:
- delivery_id, tracking_number, sender_id, sender_name, cod_amount, created_at, updated_at

Receiver fields:
- receiver_id, receiver_first_name, receiver_last_name, receiver_full_name, receiver_phone

Address fields:
- Dropoff: dropoff_first_line, dropoff_state, dropoff_country_name, dropoff_city_name
- Pickup: pickup_first_line, pickup_state, pickup_country_name, pickup_city_name

IMPORTANT PERFORMANCE RULE:
Avoid using YEAR(column_name) or MONTH(column_name) or DATE(column_name) or DATE_SUB(column_name, INTERVAL n DAY) or similar date functions as they prevent index usage. Use BETWEEN instead.

Example:
❌ WHERE YEAR(created_at) = 2024
✅ WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31 23:59:59'

❌ WHERE DATE(created_at) >= '2024-01-01'
✅ WHERE created_at >= '2024-01-01 00:00:00'

For forecasting, focus on:
- Time-based aggregations (daily, weekly, monthly trends)
- Historical patterns over time periods
- Seasonal variations
- Growth trends

Always use the view name: new_deliveries_dashboard_cdc
Generate queries that return time-series data suitable for forecasting analysis.
Return only valid SQL query without markdown formatting.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.1,
        max_tokens: 300,
      });

      const sqlQuery = completion.choices[0]?.message?.content?.trim();
      
      // Extract SQL from markdown if present
      let cleanSqlQuery = sqlQuery;
      if (sqlQuery && sqlQuery.includes('```')) {
        const sqlMatch = sqlQuery.match(/```(?:sql)?\s*([\s\S]*?)\s*```/);
        if (sqlMatch) {
          cleanSqlQuery = sqlMatch[1].trim();
        }
      }
      
      if (cleanSqlQuery && cleanSqlQuery.toLowerCase().startsWith('select')) {
        return cleanSqlQuery;
      }

      return null;
    } catch (error) {
      logger.error('SQL generation error:', error);
      return null;
    }
  }
}