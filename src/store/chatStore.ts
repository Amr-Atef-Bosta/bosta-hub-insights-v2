import { create } from 'zustand';

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sql?: string;
  chart?: string;
  agentUsed?: string;
  loading?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  type: 'regular' | 'dashboard';
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  dashboardConversationId: string | null;
  isLoading: boolean;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  createConversation: (title?: string) => string;
  createDashboardConversation: (title?: string) => string;
  deleteConversation: (conversationId: string) => void;
  setActiveConversation: (conversationId: string) => void;
  setDashboardConversation: (conversationId: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  dashboardConversationId: null,
  isLoading: false,

  addMessage: (conversationId, message) => {
    const messageWithId: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: [...conv.messages, messageWithId],
              updatedAt: new Date(),
            }
          : conv
      ),
    }));

    return messageWithId.id;
  },

  updateMessage: (conversationId, messageId, updates) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === messageId ? { ...msg, ...updates } : msg
              ),
              updatedAt: new Date(),
            }
          : conv
      ),
    }));
  },

  createConversation: (title = 'New Conversation') => {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newConversation: Conversation = {
      id: conversationId,
      title,
      type: 'regular',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set((state) => ({
      conversations: [newConversation, ...state.conversations],
      activeConversationId: conversationId,
    }));

    return conversationId;
  },

  createDashboardConversation: (title = 'Dashboard Chat') => {
    const conversationId = `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newConversation: Conversation = {
      id: conversationId,
      title,
      type: 'dashboard',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set((state) => ({
      conversations: [newConversation, ...state.conversations],
      dashboardConversationId: conversationId,
    }));

    return conversationId;
  },

  deleteConversation: (conversationId) => {
    set((_get) => ({
      conversations: _get.conversations.filter((conv) => conv.id !== conversationId),
      activeConversationId: 
        _get.activeConversationId === conversationId 
          ? _get.conversations.find(conv => conv.id !== conversationId)?.id || null
          : _get.activeConversationId,
      dashboardConversationId:
        _get.dashboardConversationId === conversationId
          ? null
          : _get.dashboardConversationId,
    }));
  },

  setActiveConversation: (conversationId) => {
    set({ activeConversationId: conversationId });
  },

  setDashboardConversation: (conversationId) => {
    set({ dashboardConversationId: conversationId });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },
}));