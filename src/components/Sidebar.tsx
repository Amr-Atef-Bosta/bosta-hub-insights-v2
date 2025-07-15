import React from 'react';
import { NavLink } from 'react-router-dom';
import { MessageSquare, Database, Bot, Settings, BarChart3, BookTemplate as FileTemplate, Target, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();

  const navigation = [
    { name: 'Chat', href: '/chat', icon: MessageSquare, roles: ['admin', 'leader', 'am', 'analyst'] },
    { name: 'Connectors', href: '/connectors', icon: Database, roles: ['admin'] },
    { name: 'Agents', href: '/agents', icon: Bot, roles: ['admin'] },
    { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3, roles: ['admin', 'leader', 'am'] },
    { name: 'Templates', href: '/templates', icon: FileTemplate, roles: ['admin', 'leader'], phase2: true },
    { name: 'KPI Catalog', href: '/kpi', icon: Target, roles: ['admin', 'leader'], phase2: true },
  ];

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(user?.role || '')
  );

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <img src="/bosta-logo.svg" alt="Bosta" className="h-8 w-auto" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Insight Hub</h1>
            <p className="text-sm text-gray-500">v2.0</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {filteredNavigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                isActive
                  ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              } ${item.phase2 ? 'opacity-50' : ''}`
            }
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.name}
            {item.phase2 && (
              <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                Phase 2
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-700">
                  {user?.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;