import { MakeChartTool } from './MakeChartTool.js';
import { logger } from '../utils/logger.js';

interface ForecastResult {
  forecast: number[];
  confidence: number[];
  chartUrl?: string;
}

export class ForecastTool {
  private makeChartTool: MakeChartTool;

  constructor() {
    this.makeChartTool = new MakeChartTool();
  }

  async generateForecast(timeSeriesData: any[]): Promise<ForecastResult> {
    try {
      // Simple linear regression forecast (placeholder for Phase 1)
      const values = this.extractValues(timeSeriesData);
      const forecast = this.simpleLinearForecast(values, 7); // 7 periods ahead
      const confidence = this.calculateConfidence(values, forecast);

      // Create forecast chart
      const chartSpec = this.createForecastChart(timeSeriesData, forecast);
      const chartUrl = await this.makeChartTool.createChart(chartSpec);

      return {
        forecast,
        confidence,
        chartUrl,
      };
    } catch (error) {
      logger.error('Forecast generation error:', error);
      throw new Error('Failed to generate forecast');
    }
  }

  private extractValues(data: any[]): number[] {
    // Extract numeric values from the data
    return data.map(row => {
      const values = Object.values(row);
      // Find the first numeric value
      for (const value of values) {
        if (typeof value === 'number' && !isNaN(value)) {
          return value;
        }
      }
      return 0;
    });
  }

  private simpleLinearForecast(values: number[], periods: number): number[] {
    if (values.length < 2) {
      return new Array(periods).fill(values[0] || 0);
    }

    // Calculate linear trend
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate forecast
    const forecast = [];
    for (let i = 0; i < periods; i++) {
      const futureX = n + i;
      const predictedY = slope * futureX + intercept;
      forecast.push(Math.max(0, predictedY)); // Ensure non-negative
    }

    return forecast;
  }

  private calculateConfidence(historical: number[], forecast: number[]): number[] {
    // Simple confidence calculation based on historical variance
    const mean = historical.reduce((a, b) => a + b, 0) / historical.length;
    const variance = historical.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historical.length;
    const stdDev = Math.sqrt(variance);

    // Return confidence intervals (±1 standard deviation)
    return forecast.map(() => stdDev);
  }

  private createForecastChart(historical: any[], forecast: number[]): any {
    const historicalLabels = historical.map((row, i) => `Period ${i + 1}`);
    const forecastLabels = forecast.map((_, i) => `Forecast ${i + 1}`);
    const allLabels = [...historicalLabels, ...forecastLabels];

    const historicalValues = this.extractValues(historical);
    const _allValues = [...historicalValues, ...forecast];

    return {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Historical Data',
            data: [...historicalValues, ...new Array(forecast.length).fill(null)],
            borderColor: '#D71920',
            backgroundColor: 'rgba(215, 25, 32, 0.1)',
            fill: false,
          },
          {
            label: 'Forecast',
            data: [...new Array(historicalValues.length).fill(null), ...forecast],
            borderColor: '#FF6B6B',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            borderDash: [5, 5],
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Time Series Forecast',
          },
          legend: {
            display: true,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    };
  }
}