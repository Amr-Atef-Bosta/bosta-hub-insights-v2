import React, { useState, useEffect } from 'react';
import { Bot, Save, RotateCcw } from 'lucide-react';
import { agentService } from '../services/agentService';
import toast from 'react-hot-toast';

interface AgentPrompt {
  id: string;
  agent_name: string;
  system_prompt: string;
  model: string;
  tools: string[];
  updated_at: string;
}

const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const data = await agentService.getAgents();
      setAgents(data);
    } catch (error) {
      toast.error('Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (agentId: string, prompt: string) => {
    setSaving(agentId);
    try {
      await agentService.updateAgentPrompt(agentId, prompt);
      toast.success('Agent prompt updated successfully');
      fetchAgents();
    } catch (error) {
      toast.error('Failed to update agent prompt');
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async (agentId: string) => {
    if (!confirm('Are you sure you want to reset this agent to default settings?')) return;
    
    try {
      await agentService.resetAgentPrompt(agentId);
      toast.success('Agent prompt reset to default');
      fetchAgents();
    } catch (error) {
      toast.error('Failed to reset agent prompt');
    }
  };

  const updateAgentPrompt = (agentId: string, newPrompt: string) => {
    setAgents(prev => prev.map(agent => 
      agent.id === agentId ? { ...agent, system_prompt: newPrompt } : agent
    ));
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Configuration</h1>
        <p className="text-gray-600 mt-1">Customize the behavior and prompts for each AI agent</p>
      </div>

      <div className="space-y-6">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Bot className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{agent.agent_name}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Model: {agent.model}</span>
                    <span>Tools: {agent.tools.join(', ')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleReset(agent.id)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
                <button
                  onClick={() => handleSave(agent.id, agent.system_prompt)}
                  disabled={saving === agent.id}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving === agent.id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  <span>Save</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System Prompt
              </label>
              <textarea
                value={agent.system_prompt}
                onChange={(e) => updateAgentPrompt(agent.id, e.target.value)}
                rows={8}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                placeholder="Enter the system prompt for this agent..."
              />
              <p className="text-xs text-gray-500 mt-1">
                This prompt defines the agent's behavior, expertise, and response style.
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentsPage;