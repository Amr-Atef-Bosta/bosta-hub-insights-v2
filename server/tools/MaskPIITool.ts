import { getDatabase } from '../database/init.js';
import { logger } from '../utils/logger.js';

export class MaskPIITool {
  async maskData(data: any[], userRole: string): Promise<any[]> {
    if (userRole === 'admin') {
      return data; // Admins see everything
    }

    try {
      // Get PII columns from settings
      const db = getDatabase();
      const [rows] = await db.execute(
        'SELECT setting_value FROM settings WHERE setting_key = ?',
        ['pii_columns']
      ) as [any[], any];

      const piiColumns = (rows as any[]).length > 0 
        ? JSON.parse((rows as any[])[0].setting_value) 
        : [];

      if (piiColumns.length === 0) {
        return data;
      }

      // Mask PII columns
      return data.map(row => {
        const maskedRow = { ...row };
        
        for (const column of piiColumns) {
          if (maskedRow.hasOwnProperty(column)) {
            maskedRow[column] = this.maskValue(maskedRow[column]);
          }
        }
        
        return maskedRow;
      });
    } catch (error) {
      logger.error('PII masking error:', error);
      return data; // Return original data if masking fails
    }
  }

  private maskValue(value: any): string {
    if (value === null || value === undefined) {
      return value;
    }

    const str = String(value);
    
    // Email masking
    if (str.includes('@')) {
      const [local, domain] = str.split('@');
      return `${local.charAt(0)}***@${domain}`;
    }
    
    // Phone number masking
    if (/^\+?[\d\s\-\(\)]+$/.test(str) && str.replace(/\D/g, '').length >= 8) {
      return '*'.repeat(str.length);
    }
    
    // General text masking
    if (str.length > 3) {
      return str.charAt(0) + '*'.repeat(str.length - 2) + str.charAt(str.length - 1);
    }
    
    return '*'.repeat(str.length);
  }
}