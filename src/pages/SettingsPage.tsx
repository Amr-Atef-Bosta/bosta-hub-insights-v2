import React, { useState, useEffect } from 'react';
import { Shield, Database, Clock, Eye, EyeOff, Save } from 'lucide-react';
import { settingsService } from '../services/settingsService';
import toast from 'react-hot-toast';

interface Settings {
  pii_columns: string[];
  cache_ttl: number;
  feature_flags: {
    whatsapp_enabled: boolean;
    dashboard_enabled: boolean;
    templates_enabled: boolean;
  };
  table_access: {
    [role: string]: string[];
  };
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    pii_columns: [],
    cache_ttl: 3600,
    feature_flags: {
      whatsapp_enabled: false,
      dashboard_enabled: false,
      templates_enabled: false,
    },
    table_access: {
      am: ['orders', 'clients', 'delivery_stats'],
      leader: ['*'],
      analyst: ['orders', 'hr_%']
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPiiColumn, setNewPiiColumn] = useState('');
  const [newTableAccess, setNewTableAccess] = useState({ role: '', table: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await settingsService.getSettings();
      setSettings(data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.updateSettings(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addPiiColumn = () => {
    if (newPiiColumn.trim() && !settings.pii_columns.includes(newPiiColumn.trim())) {
      setSettings(prev => ({
        ...prev,
        pii_columns: [...prev.pii_columns, newPiiColumn.trim()]
      }));
      setNewPiiColumn('');
    }
  };

  const removePiiColumn = (column: string) => {
    setSettings(prev => ({
      ...prev,
      pii_columns: prev.pii_columns.filter(col => col !== column)
    }));
  };

  const updateFeatureFlag = (flag: keyof Settings['feature_flags'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      feature_flags: {
        ...prev.feature_flags,
        [flag]: value
      }
    }));
  };

  const addTableAccess = () => {
    if (newTableAccess.role && newTableAccess.table) {
      setSettings(prev => ({
        ...prev,
        table_access: {
          ...prev.table_access,
          [newTableAccess.role]: [
            ...(prev.table_access[newTableAccess.role] || []),
            newTableAccess.table
          ]
        }
      }));
      setNewTableAccess({ role: '', table: '' });
    }
  };

  const removeTableAccess = (role: string, table: string) => {
    setSettings(prev => ({
      ...prev,
      table_access: {
        ...prev.table_access,
        [role]: prev.table_access[role]?.filter(t => t !== table) || []
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Configure security, permissions, and system settings</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>Save Settings</span>
        </button>
      </div>

      <div className="space-y-6">
        {/* PII Columns */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">PII Column Protection</h3>
              <p className="text-sm text-gray-500">
                Columns marked as PII will be masked for non-admin users
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newPiiColumn}
                onChange={(e) => setNewPiiColumn(e.target.value)}
                placeholder="Column name (e.g., customer_phone)"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onKeyPress={(e) => e.key === 'Enter' && addPiiColumn()}
              />
              <button
                onClick={addPiiColumn}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {settings.pii_columns.map((column) => (
                <div
                  key={column}
                  className="flex items-center space-x-2 px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm"
                >
                  <span>{column}</span>
                  <button
                    onClick={() => removePiiColumn(column)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Table Access Control */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Database className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Table Access Control</h3>
              <p className="text-sm text-gray-500">
                Define which tables each role can access
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newTableAccess.role}
                onChange={(e) => setNewTableAccess(prev => ({ ...prev, role: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select Role</option>
                <option value="am">Account Manager</option>
                <option value="leader">Leader</option>
                <option value="analyst">Analyst</option>
              </select>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newTableAccess.table}
                  onChange={(e) => setNewTableAccess(prev => ({ ...prev, table: e.target.value }))}
                  placeholder="Table name or pattern"
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={addTableAccess}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(settings.table_access).map(([role, tables]) => (
                <div key={role} className="border border-gray-200 rounded-md p-3">
                  <div className="font-medium text-gray-900 capitalize mb-2">{role}</div>
                  <div className="flex flex-wrap gap-2">
                    {tables.map((table) => (
                      <div
                        key={`${role}-${table}`}
                        className="flex items-center space-x-2 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm"
                      >
                        <span>{table}</span>
                        <button
                          onClick={() => removeTableAccess(role, table)}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cache Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Cache Settings</h3>
              <p className="text-sm text-gray-500">
                Configure query result caching
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cache TTL (seconds)
            </label>
            <input
              type="number"
              value={settings.cache_ttl}
              onChange={(e) => setSettings(prev => ({ ...prev, cache_ttl: parseInt(e.target.value) || 3600 }))}
              className="w-32 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              min="60"
              max="86400"
            />
            <p className="text-xs text-gray-500 mt-1">
              How long to cache query results (60-86400 seconds)
            </p>
          </div>
        </div>

        {/* Feature Flags */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Eye className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Feature Flags</h3>
              <p className="text-sm text-gray-500">
                Enable or disable system features
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(settings.feature_flags).map(([flag, enabled]) => (
              <div key={flag} className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900 capitalize">
                    {flag.replace('_', ' ')}
                  </span>
                  {flag === 'whatsapp_enabled' && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Phase 2
                    </span>
                  )}
                </div>
                <button
                  onClick={() => updateFeatureFlag(flag as keyof Settings['feature_flags'], !enabled)}
                  className={`flex items-center space-x-2 px-3 py-1 rounded-md transition-colors ${
                    enabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={flag === 'whatsapp_enabled'} // Phase 2 feature
                >
                  {enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  <span>{enabled ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;