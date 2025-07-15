import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Minimize2, Maximize2 } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { dashboardChatService } from '../services/dashboardChatService';
import { validatedQueriesService } from '../services/validatedQueriesService';
import { FilterParams } from '../services/validatedQueriesService';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ReactSyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface DashboardFloatingChatProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterParams;
  cachedData: Record<string, any>;
  className?: string;
}

export const DashboardFloatingChat: React.FC<DashboardFloatingChatProps> = ({
  isOpen,
  onClose,
  filters,
  cachedData,
  className = ''
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    conversations,
    dashboardConversationId,
    addMessage,
    updateMessage,
    createDashboardConversation,
    setDashboardConversation,
  } = useChatStore();

  // Get or create dashboard conversation
  const dashboardConversation = conversations.find(c => c.id === dashboardConversationId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [dashboardConversation?.messages]);

  useEffect(() => {
    // Create dashboard conversation if it doesn't exist
    if (isOpen && !dashboardConversationId) {
      const newId = createDashboardConversation('Dashboard Chat');
      setDashboardConversation(newId);
    }
  }, [isOpen, dashboardConversationId, createDashboardConversation, setDashboardConversation]);

  const handleSendMessage = async () => {
    if (!message.trim() || isSending || !dashboardConversationId) return;

    const userMessage = message.trim();
    setMessage('');
    setIsSending(true);

    // Add user message
    addMessage(dashboardConversationId, {
      type: 'user',
      content: userMessage,
    });

    // Add loading assistant message
    const assistantMessageId = addMessage(dashboardConversationId, {
      type: 'assistant',
      content: '',
      loading: true,
    });

    try {
      // Build dashboard context
      const dashboardContext = validatedQueriesService.buildDashboardContext(filters, cachedData);
      
      // Send message with dashboard context
      const response = await dashboardChatService.sendMessage(
        userMessage,
        dashboardContext,
        dashboardConversationId
      );
      
      // Update the loading message with the actual response
      updateMessage(dashboardConversationId, assistantMessageId, {
        content: response.content,
        sql: response.sql,
        chart: response.chart,
        agentUsed: response.agentUsed,
        loading: false,
      });

    } catch (error) {
      updateMessage(dashboardConversationId, assistantMessageId, {
        content: 'Sorry, I encountered an error analyzing your dashboard data. Please try again.',
        loading: false,
      });
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const MessageContent: React.FC<{ message: any }> = ({ message }) => {
    if (message.loading) {
      return (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          <span className="text-gray-500">Analyzing dashboard data...</span>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        </div>
        
        {message.sql && (
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800">
              <span className="text-xs font-medium text-gray-300">SQL Query</span>
            </div>
            <ReactSyntaxHighlighter
              language="sql"
              style={atomOneDark}
              customStyle={{ margin: 0, padding: '0.75rem', fontSize: '0.75rem' }}
            >
              {message.sql}
            </ReactSyntaxHighlighter>
          </div>
        )}

        {message.chart && (
          <div className="bg-white rounded-lg border p-3">
            <img src={message.chart} alt="Generated chart" className="w-full rounded-md" />
          </div>
        )}

        {message.agentUsed && (
          <div className="text-xs text-gray-500 flex items-center space-x-1">
            <Bot className="h-3 w-3" />
            <span>Powered by {message.agentUsed}</span>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={`
      fixed bottom-20 right-6 z-40
      w-96 bg-white rounded-lg shadow-2xl border border-gray-200
      flex flex-col
      transition-all duration-200 ease-in-out
      ${isMinimized ? 'h-14' : 'h-96'}
      ${className}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Bot className="h-5 w-5 text-primary-600" />
          <h3 className="font-medium text-gray-900">Dashboard Assistant</h3>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title={isMinimized ? 'Expand chat' : 'Minimize chat'}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Close chat"
          >
            ×
          </button>
        </div>
      </div>

      {/* Chat Content - Hidden when minimized */}
      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!dashboardConversation?.messages.length ? (
              <div className="text-center text-gray-500 py-8">
                <Bot className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">Ask me anything about your dashboard data!</p>
                <p className="text-xs text-gray-400 mt-1">
                  I can analyze your current filters and chart data
                </p>
              </div>
            ) : (
              dashboardConversation.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex space-x-2 ${
                    msg.type === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.type === 'assistant' && (
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                        <Bot className="h-3 w-3 text-primary-600" />
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`max-w-xs ${
                      msg.type === 'user'
                        ? 'bg-primary-600 text-white rounded-lg px-3 py-2'
                        : 'bg-gray-100 rounded-lg p-3'
                    }`}
                  >
                    {msg.type === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <MessageContent message={msg} />
                    )}
                  </div>

                  {msg.type === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="h-3 w-3 text-gray-600" />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-3">
            <div className="flex space-x-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your dashboard data..."
                className="flex-1 resize-none border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={2}
                disabled={isSending}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || isSending}
                className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            
            {/* Context indicator */}
            <div className="mt-2 text-xs text-gray-500">
              {Object.keys(filters).length > 0 && (
                <span>Using current filters • </span>
              )}
              {Object.keys(cachedData).length} cached queries available
            </div>
          </div>
        </>
      )}
    </div>
  );
};