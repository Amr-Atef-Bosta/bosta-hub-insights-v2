import React, { useState, useEffect, createContext, useContext, useCallback, useMemo, useRef } from 'react';
import { ValidatedFilterBar } from '../components/ValidatedFilterBar';
import { ValidatedWidget } from '../components/ValidatedWidget';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FilterParams, QueryResult, validatedQueriesService } from '../services/validatedQueriesService';

// Global request manager to prevent duplicates across all renders
class GlobalRequestManager {
  private static instance: GlobalRequestManager;
  private ongoingRequests = new Set<string>();
  private completedRequests = new Set<string>();
  private requestPromises = new Map<string, Promise<QueryResult>>();
  private dataCache = new Map<string, QueryResult>();

  static getInstance(): GlobalRequestManager {
    if (!GlobalRequestManager.instance) {
      GlobalRequestManager.instance = new GlobalRequestManager();
    }
    return GlobalRequestManager.instance;
  }

  generateCacheKey(qid: string, filters: FilterParams): string {
    return `${qid}:${JSON.stringify(filters)}`;
  }

  // Check if we have cached data
  getCachedData(cacheKey: string): QueryResult | null {
    return this.dataCache.get(cacheKey) || null;
  }

  async executeRequest(qid: string, filters: FilterParams, caller?: string): Promise<QueryResult | null> {
    const cacheKey = this.generateCacheKey(qid, filters);
    
    // First check cache
    if (this.dataCache.has(cacheKey)) {
      console.log(`[Global Request Manager] ${caller}: Using cached data for ${cacheKey}`);
      return this.dataCache.get(cacheKey)!;
    }
    
    // If request is already ongoing, return the existing promise
    if (this.requestPromises.has(cacheKey)) {
      console.log(`[Global Request Manager] ${caller}: Reusing existing promise for ${cacheKey}`);
      return this.requestPromises.get(cacheKey)!;
    }

    // Double-check to prevent race conditions in rapid successive calls
    if (this.ongoingRequests.has(cacheKey)) {
      console.log(`[Global Request Manager] ${caller}: Request marked as ongoing for ${cacheKey}, waiting...`);
      // Wait a bit and check again
      await new Promise(resolve => setTimeout(resolve, 10));
      if (this.dataCache.has(cacheKey)) {
        return this.dataCache.get(cacheKey)!;
      }
      if (this.requestPromises.has(cacheKey)) {
        return this.requestPromises.get(cacheKey)!;
      }
    }

    // Start new request
    console.log(`[Global Request Manager] ${caller}: Starting new request for ${cacheKey}`);
    this.ongoingRequests.add(cacheKey);

    const promise = validatedQueriesService.executeValidatedQuery(qid, filters)
      .then(result => {
        console.log(`[Global Request Manager] ${caller}: Success for ${cacheKey}`);
        this.dataCache.set(cacheKey, result);
        return result;
      })
      .catch(err => {
        console.error(`[Global Request Manager] ${caller}: Error for ${cacheKey}:`, err);
        throw err;
      })
      .finally(() => {
        this.ongoingRequests.delete(cacheKey);
        this.requestPromises.delete(cacheKey);
      });

    this.requestPromises.set(cacheKey, promise);
    return promise;
  }

  clearCache(): void {
    console.log('[Global Request Manager] Clearing all caches');
    this.ongoingRequests.clear();
    this.completedRequests.clear();
    this.requestPromises.clear();
    this.dataCache.clear();
  }

  isOngoing(cacheKey: string): boolean {
    return this.ongoingRequests.has(cacheKey);
  }

  isCompleted(cacheKey: string): boolean {
    return this.dataCache.has(cacheKey);
  }
}

// Data sharing context for dashboard queries
interface DashboardData {
  [key: string]: QueryResult | null;
}

interface DashboardDataContextType {
  data: DashboardData;
  loading: { [key: string]: boolean };
  error: { [key: string]: string | null };
  loadData: (qid: string, filters: FilterParams, caller?: string) => Promise<void>;
}

const DashboardDataContext = createContext<DashboardDataContextType | null>(null);

// Custom hook to use dashboard data
export const useDashboardData = () => {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error('useDashboardData must be used within DashboardDataProvider');
  }
  return context;
};

// Data provider component
const DashboardDataProvider: React.FC<{ children: React.ReactNode; filters: FilterParams }> = ({ 
  children, 
  filters 
}) => {
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<{ [key: string]: string | null }>({});
  
  // Get the global request manager instance
  const requestManager = useMemo(() => GlobalRequestManager.getInstance(), []);

  // Clean and simple loadData function that prevents duplicates
  const loadData = useCallback(async (qid: string, queryFilters: FilterParams, caller?: string) => {
    const cacheKey = requestManager.generateCacheKey(qid, queryFilters);
    
    // Check global cache first
    const cachedData = requestManager.getCachedData(cacheKey);
    if (cachedData) {
      console.log(`[Data Loading] ${caller || 'Unknown'}: Using global cached data for ${cacheKey}`);
      setData(prev => ({ ...prev, [cacheKey]: cachedData }));
      return;
    }
    
    // Check if we already have data in local state
    if (data[cacheKey]) {
      console.log(`[Data Loading] ${caller || 'Unknown'}: Data already exists in local state for ${cacheKey}`);
      return;
    }

    // Check if loading
    if (loading[cacheKey]) {
      console.log(`[Data Loading] ${caller || 'Unknown'}: Already loading ${cacheKey}`);
      return;
    }

    try {
      // Set loading state
      setLoading(prev => ({ ...prev, [cacheKey]: true }));
      setError(prev => ({ ...prev, [cacheKey]: null }));

      // Use global request manager to execute request (handles deduplication)
      const result = await requestManager.executeRequest(qid, queryFilters, caller);
      
      if (result) {
        setData(prev => ({ ...prev, [cacheKey]: result }));
      }
    } catch (err) {
      console.error(`[Data Loading] ${caller || 'Unknown'}: Error for ${cacheKey}:`, err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(prev => ({ ...prev, [cacheKey]: errorMessage }));
    } finally {
      setLoading(prev => ({ ...prev, [cacheKey]: false }));
    }
  }, [requestManager, data, loading]);

  // Clear data when filters change
  const filtersString = useMemo(() => JSON.stringify(filters), [filters]);
  useEffect(() => {
    console.log('[Data Provider] Filters changed, clearing cache');
    setData({});
    setError({});
    setLoading({});
    requestManager.clearCache();
  }, [filtersString, requestManager]);

  return (
    <DashboardDataContext.Provider value={{ data, loading, error, loadData }}>
      {children}
    </DashboardDataContext.Provider>
  );
};

const DashboardPage: React.FC = () => {
  const [filters, setFilters] = useState<FilterParams>({});

  // Memoize today-only filters to prevent unnecessary re-renders
  const getTodayOnlyFilters = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      ...filters, // Keep other filters like merchant, region, tier, am
      start_date: today,
      end_date: today
    };
  }, [filters]);

  return (
    <DashboardDataProvider filters={filters}>
      <div className="p-6 space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">AM Dashboard</h1>
          <p className="text-gray-600 mt-1">Account Manager performance and insights</p>
        </div>

        {/* Filter Bar */}
        <ErrorBoundary>
          <ValidatedFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            className="mb-6"
          />
        </ErrorBoundary>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ErrorBoundary>
            <SharedValidatedWidget
              qid="AM_VOL_ZONE_DAILY"
              title="Daily Volume by Zone"
              type="kpi_card"
              metric="delivery_count"
              filters={filters}
              className="bg-white"
            />
          </ErrorBoundary>
          
          <ErrorBoundary>
            <SharedValidatedWidget
              qid="AM_REVENUE_MONTHLY"
              title="Monthly Revenue"
              type="kpi_card"
              metric="total_revenue"
              filters={filters}
              className="bg-white"
            />
          </ErrorBoundary>

          <ErrorBoundary>
            <SharedValidatedWidget
              qid="AM_REVENUE_ZONE_DAILY"
              title="Zone Revenue (Today)"
              type="kpi_card"
              metric="daily_revenue"
              filters={getTodayOnlyFilters}
              className="bg-white"
            />
          </ErrorBoundary>

          <ErrorBoundary>
            <SharedValidatedWidget
              qid="AM_REVENUE_TYPE_DAILY"
              title="Revenue by Type"
              type="kpi_card"
              metric="revenue"
              filters={filters}
              className="bg-white"
            />
          </ErrorBoundary>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ErrorBoundary>
            <SharedValidatedWidget
              qid="AM_VOL_ZONE_DAILY"
              title="Volume Trends by Zone"
              type="chart"
              filters={filters}
              className="bg-white"
            />
          </ErrorBoundary>

          <ErrorBoundary>
            <SharedValidatedWidget
              qid="AM_REVENUE_MONTHLY"
              title="Revenue Growth"
              type="chart"
              filters={filters}
              className="bg-white"
            />
          </ErrorBoundary>
        </div>

        {/* Full Width Charts */}
        <div className="grid grid-cols-1 gap-6">
          <ErrorBoundary>
            <SharedValidatedWidget
              qid="AM_REVENUE_ZONE_DAILY"
              title="Daily Revenue by Zone"
              type="chart"
              filters={filters}
              className="bg-white"
            />
          </ErrorBoundary>

          <ErrorBoundary>
            <SharedValidatedWidget
              qid="AM_REVENUE_TYPE_DAILY"
              title="Revenue Breakdown by Service Type"
              type="chart"
              filters={filters}
              className="bg-white"
            />
          </ErrorBoundary>
        </div>

        {/* Data Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ErrorBoundary>
            <SharedValidatedWidget
              qid="AM_VOL_ZONE_DAILY"
              title="Volume Details"
              type="table"
              filters={filters}
              className="bg-white"
            />
          </ErrorBoundary>

          <ErrorBoundary>
            <SharedValidatedWidget
              qid="AM_REVENUE_TYPE_DAILY"
              title="Revenue by Type Details"
              type="table"
              filters={filters}
              className="bg-white"
            />
          </ErrorBoundary>
        </div>
      </div>
    </DashboardDataProvider>
  );
};

// Enhanced ValidatedWidget that uses shared data
interface SharedValidatedWidgetProps {
  qid: string;
  title: string;
  type: 'chart' | 'kpi_card' | 'table';
  chartHint?: string;
  metric?: string;
  filters: FilterParams;
  className?: string;
}

const SharedValidatedWidget: React.FC<SharedValidatedWidgetProps> = (props) => {
  const { data, loading, error, loadData } = useDashboardData();
  const { qid, filters, title } = props;
  
  // Track if this component has already made its request
  const hasRequestedRef = useRef(false);
  
  // Memoize cache key to prevent unnecessary re-calculations
  const cacheKey = useMemo(() => {
    return `${qid}:${JSON.stringify(filters)}`;
  }, [qid, filters]);

  // Only trigger loadData once per cache key change
  useEffect(() => {
    // Reset the request flag when cache key changes
    hasRequestedRef.current = false;
  }, [cacheKey]);

  useEffect(() => {
    // Only make the request if we haven't already requested this cache key
    if (!hasRequestedRef.current) {
      console.log(`[${title}] Calling loadData for ${qid} with cacheKey: ${cacheKey}`);
      hasRequestedRef.current = true;
      loadData(qid, filters, `SharedValidatedWidget: ${title}`);
    } else {
      console.log(`[${title}] Skipping duplicate loadData call for ${qid}`);
    }
  }, [cacheKey, loadData, qid, filters, title]);

  // Pass the shared data to the original ValidatedWidget
  return (
    <ValidatedWidget 
      {...props} 
      // Override the internal data loading with our shared data
      sharedData={data[cacheKey]}
      sharedLoading={loading[cacheKey] || false}
      sharedError={error[cacheKey] || null}
    />
  );
};

export default DashboardPage;