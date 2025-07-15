import api from './api';

export interface Connector {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'mongodb' | 'redis';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  status: 'connected' | 'disconnected' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectorData {
  name: string;
  type: Connector['type'];
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export const connectorService = {
  async getConnectors(): Promise<Connector[]> {
    const response = await api.get('/connectors');
    return response.data;
  },

  async createConnector(data: CreateConnectorData): Promise<Connector> {
    const response = await api.post('/connectors', data);
    return response.data;
  },

  async updateConnector(id: string, data: Partial<CreateConnectorData>): Promise<Connector> {
    const response = await api.put(`/connectors/${id}`, data);
    return response.data;
  },

  async deleteConnector(id: string): Promise<void> {
    await api.delete(`/connectors/${id}`);
  },

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/connectors/${id}/test`);
    return response.data;
  },
};