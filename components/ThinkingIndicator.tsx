import React from 'react';

export const ThinkingIndicator: React.FC = () => {
  return (
    <div className="flex items-center space-x-2 p-4 bg-white rounded-2xl rounded-tl-none shadow-sm border border-slate-100 w-fit">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
      </div>
      <span className="text-xs text-slate-500 font-medium">Researching...</span>
    </div>
  );
};