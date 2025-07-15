import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, Trash2, MessageSquare, Bot, User, Code, BarChart3, CheckCircle, AlertTriangle } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { chatService } from '../services/chatService';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ReactSyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

const ChatPage: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const _user = useAuthStore((state) => state.user);
  const {
    conversations,
    activeConversationId,
    addMessage,
    updateMessage,
    createConversation,
    deleteConversation,
    setActiveConversation,
  } = useChatStore();

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  useEffect(() => {
    if (conversations.length === 0) {
      createConversation('Welcome Chat');
    }
  }, [conversations.length, createConversation]);

  const handleSendMessage = async () => {
    if (!message.trim() || isSending) return;

    let conversationId = activeConversationId;
    if (!conversationId) {
      conversationId = createConversation();
    }

    const userMessage = message.trim();
    setMessage('');
    setIsSending(true);

    // Add user message
    addMessage(conversationId, {
      type: 'user',
      content: userMessage,
    });

    // Add loading assistant message and get its ID
    const assistantMessageId = addMessage(conversationId, {
      type: 'assistant',
      content: '',
      loading: true,
    });

    try {
      const response = await chatService.sendMessage(userMessage, conversationId);
      
      // Update the loading message with the actual response
      updateMessage(conversationId, assistantMessageId, {
        content: response.content,
        sql: response.sql,
        chart: response.chart,
        agentUsed: response.agentUsed,
        loading: false,
      });

      // Update conversation title if it's the first message
      if (activeConversation?.messages.length === 1) {
        // TODO: Update conversation title based on first message
      }
    } catch (_error) {
      updateMessage(conversationId, assistantMessageId, {
        content: 'Sorry, I encountered an error processing your request. Please try again.',
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

  const handleNewChat = () => {
    const newId = createConversation();
    setActiveConversation(newId);
  };

  const handleDeleteConversation = (conversationId: string) => {
    deleteConversation(conversationId);
    toast.success('Conversation deleted');
  };

  const MessageContent: React.FC<{ message: any }> = ({ message }) => {
    if (message.loading) {
      return (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          <span className="text-gray-500">Thinking...</span>
        </div>
      );
    }

    const renderValidationBadge = () => {
      if (!message.validationBadge) return null;

      const isValidated = message.validationBadge === 'validated';
      
      return (
        <div className="flex items-center space-x-2 mt-3">
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
            isValidated 
              ? 'bg-green-100 text-green-800' 
              : 'bg-orange-100 text-orange-800'
          }`}>
            {isValidated ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            <span>{isValidated ? '✓ Validated' : '⚠ AI-Generated'}</span>
          </div>
          {message.confidence && (
            <div className="text-xs text-gray-500">
              Confidence: {Math.round(message.confidence * 100)}%
            </div>
          )}
        </div>
      );
    };

    const renderSources = () => {
      if (!message.sources || message.sources.length === 0) return null;

      return (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
          <div className="text-xs font-medium text-blue-900 mb-1">
            Data Sources:
          </div>
          <div className="flex flex-wrap gap-1">
            {message.sources.map((source: string, index: number) => (
              <span 
                key={index}
                className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
              >
                {source}
              </span>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-3">
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        
        {message.sql && (
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
              <div className="flex items-center space-x-2">
                <Code className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-300">SQL Query</span>
              </div>
            </div>
            <ReactSyntaxHighlighter
              language="sql"
              style={atomOneDark}
              customStyle={{ margin: 0, padding: '1rem' }}
            >
              {message.sql}
            </ReactSyntaxHighlighter>
          </div>
        )}

        {message.chart && (
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center space-x-2 mb-3">
              <BarChart3 className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-medium text-gray-700">Generated Chart</span>
            </div>
            <img src={message.chart} alt="Generated chart" className="w-full rounded-md" />
          </div>
        )}

        {renderSources()}
        {renderValidationBadge()}

        {message.agentUsed && (
          <div className="text-xs text-gray-500 flex items-center space-x-1">
            <Bot className="h-3 w-3" />
            <span>Powered by {message.agentUsed}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Conversations Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                activeConversationId === conversation.id
                  ? 'bg-primary-50 border border-primary-200'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => setActiveConversation(conversation.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {conversation.title}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {format(conversation.updatedAt, 'MMM d, h:mm a')}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteConversation(conversation.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex space-x-3 ${
                    message.type === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.type === 'assistant' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary-600" />
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`max-w-3xl ${
                      message.type === 'user'
                        ? 'bg-primary-600 text-white rounded-lg px-4 py-2'
                        : 'bg-white rounded-lg border border-gray-200 p-4'
                    }`}
                  >
                    {message.type === 'user' ? (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <MessageContent message={message} />
                    )}
                  </div>

                  {message.type === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-600" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-6">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about your data..."
                    className="w-full resize-none border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={3}
                    disabled={isSending}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isSending}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <Send className="h-4 w-4" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Start a new conversation
              </h3>
              <p className="text-gray-500 mb-6">
                Ask questions about your data and get instant insights
              </p>
              <button
                onClick={handleNewChat}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                New Chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;