import React, { useState, useEffect } from 'react';
import { Plus, Database, TestTube, Trash2, Edit, CheckCircle, XCircle } from 'lucide-react';
import { connectorService } from '../services/connectorService';
import toast from 'react-hot-toast';

interface Connector {
  id: string;
  name: string;
  kind: 'mysql' | 'mongo';
  conn_uri: string;
  schema_json: string;
  created_at: string;
  status?: 'connected' | 'error' | 'testing';
}

const ConnectorsPage: React.FC = () => {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConnector, setEditingConnector] = useState<Connector | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    kind: 'mysql' as 'mysql' | 'mongo',
    conn_uri: '',
    schema_json: '',
  });

  useEffect(() => {
    fetchConnectors();
  }, []);

  const fetchConnectors = async () => {
    try {
      const data = await connectorService.getConnectors();
      setConnectors(data);
    } catch (error) {
      toast.error('Failed to fetch connectors');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingConnector) {
        await connectorService.updateConnector(editingConnector.id, formData);
        toast.success('Connector updated successfully');
      } else {
        await connectorService.createConnector(formData);
        toast.success('Connector created successfully');
      }
      setShowModal(false);
      setEditingConnector(null);
      setFormData({ name: '', kind: 'mysql', conn_uri: '', schema_json: '' });
      fetchConnectors();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save connector');
    }
  };

  const handleEdit = (connector: Connector) => {
    setEditingConnector(connector);
    setFormData({
      name: connector.name,
      kind: connector.kind,
      conn_uri: connector.conn_uri,
      schema_json: connector.schema_json,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this connector?')) return;
    
    try {
      await connectorService.deleteConnector(id);
      toast.success('Connector deleted successfully');
      fetchConnectors();
    } catch (error) {
      toast.error('Failed to delete connector');
    }
  };

  const handleTest = async (connector: Connector) => {
    try {
      setConnectors(prev => prev.map(c => c.id === connector.id ? { ...c, status: 'testing' } : c));
      const result = await connectorService.testConnection(connector.id);
      setConnectors(prev => prev.map(c => 
        c.id === connector.id ? { ...c, status: result.success ? 'connected' : 'error' } : c
      ));
      if (result.success) {
        toast.success(`Connected! Found tables: ${result.tables?.join(', ')}`);
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      setConnectors(prev => prev.map(c => c.id === connector.id ? { ...c, status: 'error' } : c));
      toast.error('Connection test failed');
    }
  };

  const handleSchemaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          JSON.parse(content); // Validate JSON
          setFormData(prev => ({ ...prev, schema_json: content }));
          toast.success('Schema file uploaded successfully');
        } catch {
          toast.error('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Database Connectors</h1>
          <p className="text-gray-600 mt-1">Manage your database connections and schemas</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Connector</span>
        </button>
      </div>

      <div className="grid gap-6">
        {connectors.map((connector) => (
          <div key={connector.id} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Database className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{connector.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{connector.kind} Database</p>
                </div>
                {connector.status && (
                  <div className="flex items-center space-x-1">
                    {connector.status === 'connected' && (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600">Connected</span>
                      </>
                    )}
                    {connector.status === 'error' && (
                      <>
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-red-600">Error</span>
                      </>
                    )}
                    {connector.status === 'testing' && (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                        <span className="text-sm text-primary-600">Testing...</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleTest(connector)}
                  disabled={connector.status === 'testing'}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors disabled:opacity-50"
                >
                  <TestTube className="h-3 w-3" />
                  <span>Test</span>
                </button>
                <button
                  onClick={() => handleEdit(connector)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  <Edit className="h-3 w-3" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(connector.id)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Connection URI:</span>
                <p className="text-gray-600 mt-1 font-mono truncate">
                  {connector.conn_uri.replace(/\/\/.*:.*@/, '//*****:*****@')}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Schema:</span>
                <p className="text-gray-600 mt-1">
                  {connector.schema_json ? 'Uploaded' : 'Not configured'}
                </p>
              </div>
            </div>
          </div>
        ))}

        {connectors.length === 0 && (
          <div className="text-center py-12">
            <Database className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No connectors configured</h3>
            <p className="text-gray-500 mb-6">Add your first database connector to get started</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add Connector
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingConnector ? 'Edit Connector' : 'Add New Connector'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Production MySQL"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Database Type
                </label>
                <select
                  value={formData.kind}
                  onChange={(e) => setFormData(prev => ({ ...prev, kind: e.target.value as 'mysql' | 'mongo' }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="mysql">MySQL</option>
                  <option value="mongo">MongoDB</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Connection URI
                </label>
                <input
                  type="text"
                  required
                  value={formData.conn_uri}
                  onChange={(e) => setFormData(prev => ({ ...prev, conn_uri: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={formData.kind === 'mysql' ? 'mysql://user:pass@host:port/db' : 'mongodb://user:pass@host:port/db'}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schema JSON (Optional)
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleSchemaUpload}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upload a JSON file containing your database schema
                </p>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingConnector(null);
                    setFormData({ name: '', kind: 'mysql', conn_uri: '', schema_json: '' });
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                >
                  {editingConnector ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectorsPage;