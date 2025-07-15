import React from 'react';
import { MessageSquare, X } from 'lucide-react';

interface DashboardChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
  hasUnreadMessages?: boolean;
}

export const DashboardChatButton: React.FC<DashboardChatButtonProps> = ({
  isOpen,
  onClick,
  hasUnreadMessages = false
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-6 right-6 z-50
        w-14 h-14 rounded-full shadow-lg
        flex items-center justify-center
        transition-all duration-200 ease-in-out
        hover:scale-105 active:scale-95
        ${isOpen 
          ? 'bg-gray-600 hover:bg-gray-700' 
          : 'bg-primary-600 hover:bg-primary-700'
        }
        text-white
      `}
      title={isOpen ? 'Close dashboard chat' : 'Ask about dashboard data'}
    >
      {/* Unread indicator */}
      {hasUnreadMessages && !isOpen && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
      )}
      
      {/* Icon with smooth transition */}
      <div className="relative">
        <MessageSquare 
          className={`h-6 w-6 transition-all duration-200 ${
            isOpen ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100'
          }`} 
        />
        <X 
          className={`h-6 w-6 absolute inset-0 transition-all duration-200 ${
            isOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75'
          }`} 
        />
      </div>
    </button>
  );
};