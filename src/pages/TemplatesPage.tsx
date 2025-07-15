import React from 'react';
import { BookTemplate as FileTemplate, AlertTriangle } from 'lucide-react';

const TemplatesPage: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
        <p className="text-gray-600 mt-1">Pre-built query and report templates</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="h-6 w-6 text-yellow-600" />
          <div>
            <h3 className="font-medium text-yellow-900">Phase 2 Feature</h3>
            <p className="text-yellow-700 text-sm mt-1">
              Template functionality is planned for Phase 2. This will include:
            </p>
            <ul className="text-yellow-700 text-sm mt-2 ml-4 list-disc">
              <li>Pre-built SQL query templates</li>
              <li>Report generation templates</li>
              <li>Custom template creation</li>
              <li>Template sharing and collaboration</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="text-center py-12">
        <FileTemplate className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No templates available</h3>
        <p className="text-gray-500">Templates will be available in Phase 2</p>
      </div>
    </div>
  );
};

export default TemplatesPage;