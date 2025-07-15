import api from './api';

export interface Settings {
  openaiApiKey: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
}

export const settingsService = {
  async getSettings(): Promise<Settings> {
    const response = await api.get('/settings');
    return response.data;
  },

  async updateSettings(settings: Settings): Promise<void> {
    await api.put('/settings', settings);
  },
};