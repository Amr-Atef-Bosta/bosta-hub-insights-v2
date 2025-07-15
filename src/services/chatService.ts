import api from './api';
import { validatedChatService } from './validatedQueriesService';

interface ChatResponse {
  content: string;
  sql?: string;
  chart?: string;
  agentUsed?: string;
  validationBadge?: 'validated' | 'ai-generated';
  sources?: string[];
  confidence?: number;
}

export const chatService = {
  async sendMessage(message: string, conversationId: string): Promise<ChatResponse> {
    // First try to get a validated answer
    try {
      const validatedResponse = await validatedChatService.askQuestion(message, 'AM');
      
      // If we have a validated answer with high confidence, use it
      if (validatedResponse.confidence && validatedResponse.confidence >= 0.8) {
        return {
          content: validatedResponse.answer,
          validationBadge: validatedResponse.badge,
          sources: validatedResponse.sources,
          confidence: validatedResponse.confidence,
          agentUsed: 'QueryAnswerAgent'
        };
      }
    } catch (error) {
      console.log('Validated query not available, falling back to AI agent');
    }

    // Fall back to regular AI agent with warning badge
    const response = await api.post('/chat', {
      message,
      conversationId,
    });

    return {
      ...response.data,
      validationBadge: 'ai-generated'
    };
  },

  async getConversationHistory(conversationId: string) {
    const response = await api.get(`/chat/history/${conversationId}`);
    return response.data;
  },
};