import React from 'react';
import { useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const location = useLocation();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/chat':
        return 'Chat Assistant';
      case '/connectors':
        return 'Database Connectors';
      case '/agents':
        return 'Agent Configuration';
      case '/settings':
        return 'Settings';
      case '/dashboard':
        return 'Dashboard';
      case '/templates':
        return 'Templates';
      case '/kpi':
        return 'KPI Catalog';
      default:
        return 'Bosta Insight Hub';
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          {getPageTitle()}
        </h1>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>
    </header>
  );
};

export default Header;