import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, BarChart3, TrendingUp, Table as TableIcon, RefreshCw } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { FilterParams, QueryResult, validatedQueriesService } from '../services/validatedQueriesService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

interface WidgetProps {
  qid: string;
  title: string;
  type: 'chart' | 'kpi_card' | 'table';
  chartHint?: string;
  metric?: string;
  filters: FilterParams;
  className?: string;
  // Optional shared data props to avoid redundant API calls
  sharedData?: QueryResult | null;
  sharedLoading?: boolean;
  sharedError?: string | null;
}

export const ValidatedWidget: React.FC<WidgetProps> = ({
  qid,
  title,
  type,
  chartHint,
  metric,
  filters,
  className = '',
  sharedData,
  sharedLoading,
  sharedError
}) => {
  const [data, setData] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Use shared data if provided, otherwise load data independently
  const effectiveData = sharedData !== undefined ? sharedData : data;
  const effectiveLoading = sharedLoading !== undefined ? sharedLoading : loading;
  const effectiveError = sharedError !== undefined ? sharedError : error;

  useEffect(() => {
    // Only load data if not using shared data system (all shared props are undefined)
    // If any of the shared props are provided (even if null), use the shared data system
    if (qid && sharedData === undefined && sharedLoading === undefined && sharedError === undefined) {
      loadData();
    } else if (sharedData !== undefined) {
      // Update last refresh when shared data changes
      setLastRefresh(new Date());
    }
  }, [qid, JSON.stringify(filters), sharedData, sharedLoading, sharedError]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const result = await validatedQueriesService.executeValidatedQuery(qid, filters);
      clearTimeout(timeoutId);
      
      // Validate the response structure
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response format from server');
      }
      
      // Ensure data property exists and is an array
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Response missing data array');
      }
      
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Widget data loading error:', err);
      
      let errorMessage = 'Failed to load data';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'Request timed out';
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          errorMessage = 'Network error - please check your connection';
        } else if (err.message.includes('401') || err.message.includes('unauthorized')) {
          errorMessage = 'Authentication error - please refresh the page';
        } else if (err.message.includes('404')) {
          errorMessage = 'Query not found';
        } else if (err.message.includes('500')) {
          errorMessage = 'Server error - please try again later';
        } else {
          errorMessage = err.message || errorMessage;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    loadData();
  };

  const renderValidationBadge = () => {
    if (!effectiveData) return null;

    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
          <CheckCircle className="h-3 w-3" />
          <span>Validated</span>
        </div>
        {effectiveData.metadata.cached && (
          <div className="text-xs text-gray-500">
            Cached • {lastRefresh.toLocaleTimeString()}
          </div>
        )}
      </div>
    );
  };

  const renderKPICard = () => {
    if (!effectiveData || !effectiveData.data.length) {
      return (
        <div className="text-center text-gray-500 py-8">
          No data available
        </div>
      );
    }

    try {
      // Helper function to safely convert values to numbers (same as in prepareChartData)
      const toNumber = (value: any): number => {
        if (typeof value === 'number' && !isNaN(value)) {
          return value;
        }
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
        }
        return 0;
      };

      // Extract the specified metric or the first numeric column
      const firstRow = effectiveData.data[0];
      if (!firstRow || typeof firstRow !== 'object') {
        return (
          <div className="text-center text-red-500 py-8">
            Invalid data format
          </div>
        );
      }

      // Get the metric value, ensuring it's safe to render
      let metricValue;
      let metricName;
      
      if (metric && firstRow[metric] !== undefined) {
        metricName = metric;
        
        // If we have multiple rows with the same metric (like zone data), aggregate them
        if (effectiveData.data.length > 1) {
          // Check if this appears to be zone/category data that should be aggregated
          const columns = Object.keys(firstRow);
          const hasZoneColumn = columns.includes('zone') || columns.includes('region');
          const hasDateColumn = columns.includes('delivery_date') || columns.includes('date');
          
          if (hasZoneColumn) {
            // This is zone data - sum the metric across all zones
            metricValue = effectiveData.data.reduce((sum, row) => {
              return sum + toNumber(row[metric]);
            }, 0);
          } else {
            // For non-zone data, use the first row value
            metricValue = toNumber(firstRow[metric]);
          }
        } else {
          metricValue = toNumber(firstRow[metric]);
        }
      } else {
        // Find the first numeric column
        const numericColumn = Object.keys(firstRow).find(key => {
          const value = firstRow[key];
          return typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)));
        });
        
        if (numericColumn) {
          metricName = numericColumn;
          
          // If we have multiple rows, aggregate numeric data
          if (effectiveData.data.length > 1) {
            const columns = Object.keys(firstRow);
            const hasZoneColumn = columns.includes('zone') || columns.includes('region');
            
            if (hasZoneColumn) {
              // Sum across all zones
              metricValue = effectiveData.data.reduce((sum, row) => {
                return sum + toNumber(row[numericColumn]);
              }, 0);
            } else {
              metricValue = toNumber(firstRow[numericColumn]);
            }
          } else {
            metricValue = toNumber(firstRow[numericColumn]);
          }
        } else {
          // Fall back to second column if no numeric column found
          const keys = Object.keys(firstRow);
          metricValue = keys.length > 1 ? firstRow[keys[1]] : firstRow[keys[0]];
          metricName = keys.length > 1 ? keys[1] : keys[0];
        }
      }

      // Safely convert metric value to displayable format
      const displayValue = (() => {
        if (typeof metricValue === 'number') {
          return metricValue.toLocaleString();
        } else if (metricValue === null || metricValue === undefined) {
          return 'N/A';
        } else if (typeof metricValue === 'object') {
          // Handle objects by converting to JSON or extracting a key
          if (metricValue && typeof metricValue === 'object') {
            // If it's an object with a single property, use that value
            const keys = Object.keys(metricValue);
            if (keys.length === 1) {
              return String(metricValue[keys[0]]);
            }
            // Otherwise convert to JSON string
            return JSON.stringify(metricValue);
          }
          return 'N/A';
        } else {
          return String(metricValue);
        }
      })();

      // Calculate trend if we have multiple rows and numeric data
      let trend = null;
      if (effectiveData.data.length > 1 && typeof metricValue === 'number') {
        // For zone data, we can't easily calculate a trend since we aggregated
        // Only calculate trend for time-series data
        const columns = Object.keys(firstRow);
        const hasDateColumn = columns.includes('delivery_date') || columns.includes('date');
        const hasZoneColumn = columns.includes('zone') || columns.includes('region');
        
        if (hasDateColumn && !hasZoneColumn && metricName) {
          const lastValue = effectiveData.data[effectiveData.data.length - 1][metricName];
          const prevValue = effectiveData.data[effectiveData.data.length - 2][metricName];
          if (typeof lastValue === 'number' && typeof prevValue === 'number' && !isNaN(lastValue) && !isNaN(prevValue) && prevValue !== 0) {
            trend = ((lastValue - prevValue) / prevValue) * 100;
          }
        }
        // Don't calculate trend for zone-aggregated data
      }

      return (
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {displayValue}
          </div>
          <div className="text-sm text-gray-600 mb-2">
            {metricName ? metricName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Value'}
          </div>
          {trend !== null && !isNaN(trend) && (
            <div className={`flex items-center justify-center space-x-1 text-sm ${
              trend >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              <TrendingUp className={`h-4 w-4 ${trend < 0 ? 'rotate-180' : ''}`} />
              <span>{Math.abs(trend).toFixed(1)}%</span>
            </div>
          )}
        </div>
      );
    } catch (error) {
      console.error('Error rendering KPI card:', error);
      return (
        <div className="text-center text-red-500 py-8">
          <div className="mb-2">Failed to render metric</div>
          <div className="text-sm text-gray-600">
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </div>
      );
    }
  };

  const renderChart = () => {
    if (!effectiveData || !effectiveData.data.length) {
      return (
        <div className="text-center text-gray-500 py-8">
          No data available
        </div>
      );
    }

    try {
      // Debug logging to see data structure
      console.log(`[Chart Debug] Query ID: ${qid}`);
      console.log(`[Chart Debug] Data length: ${effectiveData.data.length}`);
      console.log(`[Chart Debug] First row:`, effectiveData.data[0]);
      console.log(`[Chart Debug] All columns:`, Object.keys(effectiveData.data[0] || {}));
      console.log(`[Chart Debug] Chart hint:`, effectiveData.metadata?.chart_hint || chartHint);
      
      // Debug data types
      if (effectiveData.data[0]) {
        Object.keys(effectiveData.data[0]).forEach(col => {
          const value = effectiveData.data[0][col];
          console.log(`[Chart Debug] Column "${col}": value="${value}", type="${typeof value}"`);
        });
      }
      
      // Use chart_hint from metadata if available, otherwise fall back to prop
      const effectiveChartHint = effectiveData.metadata?.chart_hint || chartHint;
      const chartData = prepareChartData(effectiveData.data, effectiveChartHint);
      
      console.log(`[Chart Debug] Prepared chart data:`, chartData);
      
      if (!chartData.datasets.length) {
        return (
          <div className="text-center text-gray-500 py-8">
            Unable to render chart - no numeric data found
          </div>
        );
      }

      const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top' as const,
          },
          title: {
            display: false,
          },
        },
        scales: {
          x: {
            stacked: effectiveChartHint === 'stacked_bar',
          },
          y: {
            beginAtZero: true,
            stacked: effectiveChartHint === 'stacked_bar',
          },
        },
      };

      const ChartComponent = effectiveChartHint === 'line' ? Line : Bar;

      return (
        <div className="h-64">
          <ChartComponent data={chartData} options={options} />
        </div>
      );
    } catch (error) {
      console.error('Error rendering chart:', error);
      return (
        <div className="text-center text-red-500 py-8">
          <div className="mb-2">Chart rendering failed</div>
          <div className="text-sm text-gray-600">
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </div>
      );
    }
  };

  const renderTable = () => {
    if (!effectiveData || !effectiveData.data.length) {
      return (
        <div className="text-center text-gray-500 py-8">
          No data available
        </div>
      );
    }

    const columns = Object.keys(effectiveData.data[0]);
    const displayData = effectiveData.data.slice(0, 10); // Show first 10 rows

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td key={column} className="px-4 py-3 text-sm text-gray-900">
                    {(() => {
                      const value = row[column];
                      if (typeof value === 'number') {
                        return value.toLocaleString();
                      } else if (value === null || value === undefined) {
                        return 'N/A';
                      } else if (typeof value === 'object') {
                        // Handle objects by converting to JSON or extracting a key
                        if (value && typeof value === 'object') {
                          // If it's an object with a single property, use that value
                          const keys = Object.keys(value);
                          if (keys.length === 1) {
                            return String(value[keys[0]]);
                          }
                          // Otherwise convert to JSON string
                          return JSON.stringify(value);
                        }
                        return 'N/A';
                      } else {
                        return String(value);
                      }
                    })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {effectiveData.data.length > 10 && (
          <div className="text-center text-sm text-gray-500 py-2">
            Showing 10 of {effectiveData.data.length} rows
          </div>
        )}
      </div>
    );
  };

  const prepareChartData = (rawData: any[], hint?: string) => {
    if (!rawData.length) return { labels: [], datasets: [] };

    try {
      // Helper function to safely convert values to numbers
      const toNumber = (value: any): number => {
        if (typeof value === 'number' && !isNaN(value)) {
          return value;
        }
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
        }
        return 0;
      };

      const firstRow = rawData[0];
      if (!firstRow || typeof firstRow !== 'object') {
        console.warn('Invalid chart data format:', firstRow);
        return { labels: [], datasets: [] };
      }

      const columns = Object.keys(firstRow);
      if (columns.length === 0) {
        console.warn('No columns found in chart data');
        return { labels: [], datasets: [] };
      }
      
      // Smart grouping logic: detect when we should group by categorical columns instead of dates
      // This handles cases where chart shows "Revenue by Zone", "Revenue by Service Type", etc.
      
      // Check if we have business_type column - group by that for service type charts
      if (columns.includes('business_type')) {
        const valueColumn = columns.find(col => col.includes('revenue') || col.includes('count')) || columns.find(col => {
          const value = rawData[0][col];
          return typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)));
        });
        
        if (valueColumn) {
          // Group data by business_type and sum values
          const groupedData: Record<string, number> = {};
          rawData.forEach(row => {
            const category = row['business_type'] || 'Unknown';
            const value = toNumber(row[valueColumn]);
            groupedData[category] = (groupedData[category] || 0) + value;
          });
          
          const labels = Object.keys(groupedData);
          const data = Object.values(groupedData);
          
          return {
            labels,
            datasets: [{
              label: valueColumn.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              data,
              backgroundColor: 'rgba(59, 130, 246, 0.8)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 1,
            }]
          };
        }
      }
      
      // Check if we have zone column - group by that for zone charts
      if (columns.includes('zone')) {
        const valueColumn = columns.find(col => col.includes('revenue') || col.includes('count')) || columns.find(col => {
          const value = rawData[0][col];
          return typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)));
        });
        
        if (valueColumn) {
          console.log(`[Chart Debug] Zone chart detected - valueColumn: ${valueColumn}`);
          
          // Group data by zone and sum values
          const groupedData: Record<string, number> = {};
          rawData.forEach(row => {
            const category = row['zone'] || 'Unknown';
            const value = toNumber(row[valueColumn]);
            console.log(`[Chart Debug] Zone: ${category}, Value: ${row[valueColumn]} (${typeof row[valueColumn]}) -> ${value}`);
            groupedData[category] = (groupedData[category] || 0) + value;
          });
          
          const labels = Object.keys(groupedData);
          const data = Object.values(groupedData);
          
          console.log(`[Chart Debug] Zone grouping result - labels:`, labels);
          console.log(`[Chart Debug] Zone grouping result - data:`, data);
          
          return {
            labels,
            datasets: [{
              label: valueColumn.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              data,
              backgroundColor: 'rgba(59, 130, 246, 0.8)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 1,
            }]
          };
        }
      }
      
      // For stacked bar charts with specific hint
      if (hint === 'stacked_bar') {
        // Generic case for stacked bars - look for second column as category
        if (columns.length >= 3) {
          const dateColumn = columns[0]; // Usually delivery_date
          const categoryColumn = columns[1]; // Usually zone, tier, etc.
          const valueColumn = columns[2]; // Usually revenue, count, etc.
          
          console.log(`[Chart Debug] Stacked bar chart - categoryColumn: ${categoryColumn}, valueColumn: ${valueColumn}`);
          
          // Group data by category and sum values
          const groupedData: Record<string, number> = {};
          rawData.forEach(row => {
            const category = row[categoryColumn] || 'Unknown';
            const value = toNumber(row[valueColumn]);
            console.log(`[Chart Debug] Category: ${category}, Value: ${row[valueColumn]} (${typeof row[valueColumn]}) -> ${value}`);
            groupedData[category] = (groupedData[category] || 0) + value;
          });
          
          const labels = Object.keys(groupedData);
          const data = Object.values(groupedData);
          
          console.log(`[Chart Debug] Stacked bar grouping result - labels:`, labels);
          console.log(`[Chart Debug] Stacked bar grouping result - data:`, data);
          
          return {
            labels,
            datasets: [{
              label: valueColumn.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              data,
              backgroundColor: 'rgba(59, 130, 246, 0.8)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 1,
            }]
          };
        }
      }
      
      // Default behavior: use first column as labels (for time series, etc.)
      const labelColumn = columns[0];
      const labels = rawData.map(row => {
        const value = row[labelColumn];
        return value != null ? String(value) : '';
      });

      // Find numeric columns for data (handle both actual numbers and string numbers)
      const numericColumns = columns.slice(1).filter(col => {
        const value = rawData[0][col];
        // Check if it's already a number
        if (typeof value === 'number' && !isNaN(value)) {
          return true;
        }
        // Check if it's a string that can be parsed as a number
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return !isNaN(parsed) && isFinite(parsed);
        }
        return false;
      });

      console.log(`[Chart Debug] Numeric columns found:`, numericColumns);
      console.log(`[Chart Debug] Total columns:`, columns);

      if (numericColumns.length === 0) {
        console.warn('No numeric columns found for chart data');
        return { labels, datasets: [] };
      }

      let datasets;
      
      if (hint === 'stacked_bar' && numericColumns.length > 1) {
        // Traditional stacked bar chart with multiple numeric series
        const colors = [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ];

        datasets = numericColumns.map((col, index) => ({
          label: col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          data: rawData.map(row => toNumber(row[col])),
          backgroundColor: colors[index % colors.length],
          borderColor: colors[index % colors.length].replace('0.8', '1'),
          borderWidth: 1,
        }));
      } else {
        // Single series chart
        const dataColumn = numericColumns[0] || columns[1];
        datasets = [{
          label: dataColumn.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          data: rawData.map(row => toNumber(row[dataColumn])),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          fill: hint === 'line' ? false : true,
        }];
      }

      return { labels, datasets };
    } catch (error) {
      console.error('Error preparing chart data:', error);
      return { labels: [], datasets: [] };
    }
  };

  const renderContent = () => {
    if (effectiveLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      );
    }

    if (effectiveError) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <div className="text-red-600 text-center">
            <div className="font-medium">Error loading data</div>
            <div className="text-sm">{effectiveError}</div>
          </div>
          <button
            onClick={refresh}
            className="mt-3 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50"
          >
            Try Again
          </button>
        </div>
      );
    }

    switch (type) {
      case 'kpi_card':
        return renderKPICard();
      case 'chart':
        return renderChart();
      case 'table':
        return renderTable();
      default:
        return <div>Unknown widget type</div>;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'chart':
        return <BarChart3 className="h-5 w-5" />;
      case 'kpi_card':
        return <TrendingUp className="h-5 w-5" />;
      case 'table':
        return <TableIcon className="h-5 w-5" />;
      default:
        return null;
    }
  };

  return (
    <div className={`bg-white rounded-lg border shadow-sm p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {getIcon()}
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center space-x-3">
          {renderValidationBadge()}
          <button
            onClick={refresh}
            disabled={effectiveLoading}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${effectiveLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {renderContent()}
    </div>
  );
}; 