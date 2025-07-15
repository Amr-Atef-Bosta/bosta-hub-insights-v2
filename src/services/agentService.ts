import api from './api';

export interface Agent {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

export const agentService = {
  async getAgents(): Promise<Agent[]> {
    const response = await api.get('/agents');
    return response.data;
  },

  async updateAgent(id: string, data: { enabled: boolean }): Promise<void> {
    await api.put(`/agents/${id}`, {
      enabled: data.enabled,
    });
  },

  async resetAgent(id: string): Promise<void> {
    await api.post(`/agents/${id}/reset`);
  },
};