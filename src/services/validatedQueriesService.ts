import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE = '/api';

export interface ValidatedQuery {
  id: string;
  name: string;
  scope: 'AM' | 'AMM' | 'ALL';
  sql_text: string;
  chart_hint: string;
  validated_by: string;
  validated_at: string;
  active: boolean;
}

export interface FilterParams {
  start_date?: string;
  end_date?: string;
  merchant_id?: string;
  region?: string;
  tier?: string;
  am?: string;
  [key: string]: any;
}

export interface FilterDimension {
  id: string;
  label: string;
  sql_param: string;
  control: 'date_range' | 'select' | 'multiselect' | 'text';
  values_sql?: string;
  is_active: boolean;
}

export interface QueryResult {
  data: any[];
  metadata: {
    is_validated: boolean;
    query_id: string;
    query_name: string;
    chart_hint: string;
    scope: string;
    filters_applied: FilterParams;
    cached: boolean;
  };
}

export class ValidatedQueriesService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().token;
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // Get all validated queries
  async getValidatedQueries(scope?: string): Promise<ValidatedQuery[]> {
    const url = scope 
      ? `${API_BASE}/validated-queries?scope=${scope}`
      : `${API_BASE}/validated-queries`;
    
    const response = await axios.get(url, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  // Get a specific validated query
  async getValidatedQuery(id: string): Promise<ValidatedQuery> {
    const response = await axios.get(`${API_BASE}/validated-queries/${id}`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  // Create new validated query
  async createValidatedQuery(data: Omit<ValidatedQuery, 'id' | 'validated_at'>): Promise<ValidatedQuery> {
    const response = await axios.post(`${API_BASE}/validated-queries`, data, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  // Update validated query
  async updateValidatedQuery(id: string, data: Partial<ValidatedQuery>): Promise<ValidatedQuery> {
    const response = await axios.put(`${API_BASE}/validated-queries/${id}`, data, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  // Execute validated query with filters
  async executeValidatedQuery(id: string, filters: FilterParams = {}): Promise<QueryResult> {
    const response = await axios.post(`${API_BASE}/validated-queries/${id}/execute`, 
      { filters }, 
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  // Test SQL query
  async testQuery(sql: string, filters: FilterParams = {}): Promise<{ success: boolean; data?: any[]; error?: string }> {
    const response = await axios.post(`${API_BASE}/validated-queries/test`, 
      { sql, filters }, 
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  // Get filter dimensions
  async getFilterDimensions(): Promise<FilterDimension[]> {
    const response = await axios.get(`${API_BASE}/validated-queries/meta/filters`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  // Get filter options
  async getFilterOptions(param: string): Promise<any[]> {
    const response = await axios.get(`${API_BASE}/validated-queries/meta/filters/${param}/options`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  // Materialize all queries
  async materializeAllQueries(): Promise<void> {
    await axios.post(`${API_BASE}/validated-queries/materialize`, {}, {
      headers: this.getAuthHeaders(),
    });
  }

  // Deactivate query
  async deactivateQuery(id: string): Promise<void> {
    await axios.delete(`${API_BASE}/validated-queries/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  // Get current dashboard context including filters and cached data
  getCurrentDashboardContext(filters: FilterParams, requestManager: any): {
    filters: FilterParams;
    cachedData: Record<string, QueryResult>;
  } {
    return {
      filters,
      cachedData: requestManager.getAllCachedData()
    };
  }

  // Get cached query results from GlobalRequestManager
  getCachedResults(requestManager: any): Record<string, QueryResult> {
    if (requestManager && typeof requestManager.getAllCachedData === 'function') {
      return requestManager.getAllCachedData();
    }
    return {};
  }

  // Build dashboard context for chat
  buildDashboardContext(filters: FilterParams, cachedData: Record<string, QueryResult>): {
    filters: FilterParams;
    cachedData: Record<string, any>;
  } {
    // Transform cached data to match expected format
    const transformedCachedData: Record<string, any> = {};
    
    Object.entries(cachedData).forEach(([key, result]) => {
      // Extract query ID from cache key (format: "qid:filters_hash")
      const queryId = key.split(':')[0];
      
      transformedCachedData[queryId] = {
        data: result.data || [],
        metadata: {
          query_name: result.metadata?.query_name || queryId,
          chart_hint: result.metadata?.chart_hint || 'auto',
          cached: result.metadata?.cached || true
        }
      };
    });

    return {
      filters,
      cachedData: transformedCachedData
    };
  }
}

// Chat service for QueryAnswerAgent
export class ValidatedChatService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().token;
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async askQuestion(question: string, scope?: string): Promise<{
    answer: string;
    badge: 'validated' | 'ai-generated';
    sources?: string[];
    confidence?: number;
  }> {
    const response = await axios.post(`${API_BASE}/chat/validated-answer`, 
      { question, scope }, 
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  async explainSource(qid: string): Promise<{
    query: ValidatedQuery;
    explanation: string;
    lastRun: string | null;
  }> {
    const response = await axios.get(`${API_BASE}/chat/explain-source/${qid}`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }
}

export const validatedQueriesService = new ValidatedQueriesService();
export const validatedChatService = new ValidatedChatService();