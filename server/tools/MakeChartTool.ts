import { createCanvas, registerFont } from 'canvas';
import Chart from 'chart.js/auto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MakeChartTool {
  constructor() {
    // Register system fonts for better text rendering
    try {
      // Try to register DejaVu fonts if available (common in Alpine Linux)
      registerFont('/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf', { family: 'DejaVu Sans' });
      registerFont('/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf', { family: 'DejaVu Sans', weight: 'bold' });
      logger.info('✅ DejaVu fonts registered successfully');
    } catch (error) {
      logger.warn('⚠️ Could not register DejaVu fonts, using system defaults:', error);
    }
  }

  async createChart(chartSpec: any): Promise<string> {
    try {
      logger.info('🎨 Starting chart creation...');

      // Create a canvas
      const canvas = createCanvas(800, 600);
      const ctx = canvas.getContext('2d');

      // Set up text rendering properties
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      
      // Apply Bosta branding
      const brandedSpec = this.applyBranding(chartSpec);
      logger.info('🎨 Applied branding to chart spec');

      // Create chart
      new Chart(ctx as any, brandedSpec);
      logger.info('📈 Chart rendered on canvas');

      // Save to file - use process.cwd() for more reliable path
      const fileName = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
      const chartsDir = path.join(process.cwd(), 'public', 'charts');
      const filePath = path.join(chartsDir, fileName);
      
      logger.info(`📁 Charts directory: ${chartsDir}`);
      logger.info(`💾 Saving chart to: ${filePath}`);
      
      // Ensure charts directory exists
      await fs.mkdir(chartsDir, { recursive: true });
      logger.info('✅ Charts directory created/verified');
      
      // Save canvas as PNG
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(filePath, buffer);
      logger.info(`✅ Chart saved successfully: ${fileName}`);

      // Verify file was created
      try {
        const stats = await fs.stat(filePath);
        logger.info(`📊 Chart file size: ${stats.size} bytes`);
      } catch (statError) {
        logger.error('❌ Failed to verify chart file:', statError);
        throw new Error('Chart file was not created properly');
      }

      // Return URL path
      const chartUrl = `/charts/${fileName}`;
      logger.info(`🔗 Chart URL: ${chartUrl}`);
      return chartUrl;
    } catch (error) {
      logger.error('💥 Chart creation error:', error);
      // Provide more specific error information
      if (error instanceof Error) {
        logger.error(`Error details: ${error.message}`);
        logger.error(`Error stack: ${error.stack}`);
      }
      throw new Error(`Failed to create chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private applyBranding(chartSpec: any): any {
    const brandedSpec = { ...chartSpec };

    // Apply Bosta colors
    const primaryColor = '#D71920';
    const secondaryColors = [
      '#D71920', '#FF6B6B', '#4ECDC4', '#45B7D1', 
      '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'
    ];

    // Update dataset colors
    if (brandedSpec.data && brandedSpec.data.datasets) {
      brandedSpec.data.datasets.forEach((dataset: any, index: number) => {
        if (!dataset.backgroundColor) {
          dataset.backgroundColor = secondaryColors[index % secondaryColors.length];
        }
        if (!dataset.borderColor) {
          dataset.borderColor = primaryColor;
        }
      });
    }

    // Apply consistent styling with system fonts
    brandedSpec.options = {
      ...brandedSpec.options,
      responsive: false,
      plugins: {
        ...brandedSpec.options?.plugins,
        legend: {
          ...brandedSpec.options?.plugins?.legend,
          labels: {
            font: {
              family: 'DejaVu Sans, Arial, sans-serif',
              size: 12,
            },
          },
        },
        title: {
          ...brandedSpec.options?.plugins?.title,
          font: {
            family: 'DejaVu Sans, Arial, sans-serif',
            size: 16,
            weight: 'bold',
          },
        },
      },
      scales: {
        ...brandedSpec.options?.scales,
        x: {
          ...brandedSpec.options?.scales?.x,
          ticks: {
            font: {
              family: 'DejaVu Sans, Arial, sans-serif',
              size: 11,
            },
          },
        },
        y: {
          ...brandedSpec.options?.scales?.y,
          ticks: {
            font: {
              family: 'DejaVu Sans, Arial, sans-serif',
              size: 11,
            },
          },
        },
      },
    };

    return brandedSpec;
  }
}