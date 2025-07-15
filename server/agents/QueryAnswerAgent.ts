import OpenAI from 'openai';
import { ValidatedQueriesService } from '../services/validatedQueries.js';
import { getDatabase } from '../database/init.js';
import { logger } from '../utils/logger.js';

interface QueryContext {
  qid: string;
  name: string;
  sql_text: string;
  data: any[];
  confidence: number;
}

export class QueryAnswerAgent {
  private openai: OpenAI;
  private validatedQueriesService: ValidatedQueriesService;
  private readonly CONFIDENCE_THRESHOLD = 0.8;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.validatedQueriesService = new ValidatedQueriesService();
  }

  async answerQuestion(question: string, scope?: string): Promise<{
    answer: string;
    badge: 'validated' | 'ai-generated';
    sources?: string[];
    confidence?: number;
  }> {
    try {
      // First, try to find relevant validated queries
      const relevantQueries = await this.findRelevantQueries(question, scope);
      
      if (relevantQueries.length > 0) {
        const bestMatch = relevantQueries[0];
        
        if (bestMatch.confidence >= this.CONFIDENCE_THRESHOLD) {
          // High confidence - answer using validated data
          const answer = await this.generateValidatedAnswer(question, bestMatch);
          return {
            answer,
            badge: 'validated',
            sources: [bestMatch.name],
            confidence: bestMatch.confidence
          };
        }
      }

      // Low confidence or no matches - fall back to AI generation with warning
      const aiAnswer = await this.generateAIAnswer(question);
      return {
        answer: `⚠ AI-Generated - data team has not validated this query.\n\n${aiAnswer}`,
        badge: 'ai-generated'
      };

    } catch (error) {
      logger.error('QueryAnswerAgent error:', error);
      throw new Error('Failed to process question');
    }
  }

  async explainSource(qid: string): Promise<{
    query: any;
    explanation: string;
    lastRun: Date | null;
  }> {
    try {
      const query = await this.validatedQueriesService.getValidatedQuery(qid);
      if (!query) {
        throw new Error('Query not found');
      }

      // Get last run timestamp
      const db = getDatabase();
      const [lastRunRows] = await db.execute(
        'SELECT MAX(run_stamp) as last_run FROM validated_results WHERE qid = ?',
        [qid]
      );
      const lastRun = (lastRunRows as any[])[0]?.last_run || null;

      // Generate explanation
      const explanation = await this.generateQueryExplanation(query);

      return {
        query,
        explanation,
        lastRun
      };
    } catch (error) {
      logger.error('Explain source error:', error);
      throw error;
    }
  }

  private async findRelevantQueries(question: string, scope?: string): Promise<QueryContext[]> {
    // Get all validated queries for the scope
    const queries = await this.validatedQueriesService.getValidatedQueries(scope);
    
    const queryContexts: QueryContext[] = [];

    for (const query of queries) {
      try {
        // Get cached data for default filters
        const result = await this.validatedQueriesService.executeValidatedQuery(query.id);
        
        // Calculate semantic similarity (simplified version)
        const confidence = await this.calculateSemanticSimilarity(question, query);
        
        queryContexts.push({
          qid: query.id,
          name: query.name,
          sql_text: query.sql_text,
          data: result.data,
          confidence
        });
      } catch (error) {
        logger.warn(`Failed to get data for query ${query.name}:`, error);
      }
    }

    // Sort by confidence score
    return queryContexts.sort((a, b) => b.confidence - a.confidence);
  }

  private async calculateSemanticSimilarity(question: string, query: any): Promise<number> {
    // Simplified semantic similarity calculation
    // In production, you'd use proper vector embeddings and similarity search
    
    const questionLower = question.toLowerCase();
    const queryName = query.name.toLowerCase();
    const sqlText = query.sql_text.toLowerCase();
    
    let score = 0;
    
    // Check for keyword matches in query name
    const nameKeywords = queryName.split('_');
    for (const keyword of nameKeywords) {
      if (questionLower.includes(keyword)) {
        score += 0.2;
      }
    }
    
    // Check for domain-specific terms
    const domainTerms = [
      'revenue', 'volume', 'delivery', 'merchant', 'zone', 'region',
      'daily', 'monthly', 'trend', 'asp', 'order', 'amount'
    ];
    
    for (const term of domainTerms) {
      if (questionLower.includes(term) && (queryName.includes(term) || sqlText.includes(term))) {
        score += 0.15;
      }
    }
    
    // Check for metric-specific terms
    if (questionLower.includes('revenue') && query.name.includes('REVENUE')) score += 0.3;
    if (questionLower.includes('volume') && query.name.includes('VOL')) score += 0.3;
    if (questionLower.includes('daily') && query.name.includes('DAILY')) score += 0.2;
    if (questionLower.includes('monthly') && query.name.includes('MONTHLY')) score += 0.2;
    if (questionLower.includes('zone') && query.name.includes('ZONE')) score += 0.2;
    
    return Math.min(score, 1.0); // Cap at 1.0
  }

  private async generateValidatedAnswer(question: string, context: QueryContext): Promise<string> {
    const systemPrompt = `You are a data analyst answering questions using ONLY validated, cached data.

STRICT RULES:
1. Only use the provided data - never make up numbers or trends
2. If the data doesn't fully answer the question, acknowledge limitations
3. Always mention that this data is validated by the data team
4. Format numbers clearly with proper units
5. Provide a brief, accurate summary based only on what you can see in the data

Context:
- Query: ${context.name}
- Data Source: Validated SQL query approved by data team
- Sample Data: ${JSON.stringify(context.data.slice(0, 5))}
- Total Records: ${context.data.length}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    return response.choices[0]?.message?.content || 'Unable to generate answer';
  }

  private async generateAIAnswer(question: string): Promise<string> {
    const systemPrompt = `You are a helpful assistant that can provide general business insights.
However, you must be clear that your response is AI-generated and not based on validated data.
Provide helpful analysis but recommend consulting the data team for validated metrics.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    return response.choices[0]?.message?.content || 'Unable to generate response';
  }

  private async generateQueryExplanation(query: any): Promise<string> {
    const systemPrompt = `You are a technical expert explaining SQL queries to business users.
Explain what this query does in simple business terms, what data it returns, and when it was validated.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Explain this validated query:
Name: ${query.name}
Scope: ${query.scope}
SQL: ${query.sql_text}
Validated by: ${query.validated_by}
Validated on: ${query.validated_at}` 
        }
      ],
      temperature: 0.3,
      max_tokens: 400
    });

    return response.choices[0]?.message?.content || 'Unable to generate explanation';
  }
} 