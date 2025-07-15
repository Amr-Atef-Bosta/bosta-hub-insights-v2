import React from 'react';
import { Target, AlertTriangle } from 'lucide-react';

const KPIPage: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">KPI Catalog</h1>
        <p className="text-gray-600 mt-1">Key Performance Indicators and metrics</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="h-6 w-6 text-yellow-600" />
          <div>
            <h3 className="font-medium text-yellow-900">Phase 2 Feature</h3>
            <p className="text-yellow-700 text-sm mt-1">
              KPI Catalog functionality is planned for Phase 2. This will include:
            </p>
            <ul className="text-yellow-700 text-sm mt-2 ml-4 list-disc">
              <li>Predefined business KPIs</li>
              <li>Custom KPI definitions</li>
              <li>KPI tracking and alerts</li>
              <li>Performance benchmarking</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="text-center py-12">
        <Target className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No KPIs defined</h3>
        <p className="text-gray-500">KPI definitions will be available in Phase 2</p>
      </div>
    </div>
  );
};

export default KPIPage;