import api from './api';

interface DashboardChatResponse {
  content: string;
  sql?: string;
  chart?: string;
  agentUsed: string;
  data?: any[];
  conversationId: string;
  timestamp: string;
}

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

export const dashboardChatService = {
  async sendMessage(
    message: string, 
    dashboardContext: DashboardContext,
    conversationId?: string
  ): Promise<DashboardChatResponse> {
    const response = await api.post('/dashboard-chat', {
      message,
      filters: dashboardContext.filters,
      cachedData: dashboardContext.cachedData,
      conversationId,
    });

    return response.data;
  },

  async getConversationHistory(conversationId: string) {
    const response = await api.get(`/chat/history/${conversationId}`);
    return response.data;
  },
};