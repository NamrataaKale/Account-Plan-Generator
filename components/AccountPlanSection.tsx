import React, { useState, useEffect } from 'react';
import { AccountPlanKey } from '../types';

interface AccountPlanSectionProps {
  title: string;
  sectionKey: AccountPlanKey;
  content: string;
  onUpdate: (key: AccountPlanKey, value: string) => void;
  className?: string;
  mode?: 'card' | 'document';
}

export const AccountPlanSection: React.FC<AccountPlanSectionProps> = ({
  title,
  sectionKey,
  content,
  onUpdate,
  className,
  mode = 'card',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempContent, setTempContent] = useState(content);
  // Track if this specific section is currently being read aloud
  const [isReading, setIsReading] = useState(false);

  // Sync temp content if external update happens (e.g. AI updates it while not editing)
  useEffect(() => {
    if (!isEditing) {
      setTempContent(content);
    }
  }, [content, isEditing]);

  // Cleanup: Stop speaking if component unmounts while reading
  useEffect(() => {
    return () => {
      if (isReading) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isReading]);

  const handleSave = () => {
    onUpdate(sectionKey, tempContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempContent(content);
    setIsEditing(false);
  };

  // Helper to strip markdown for natural sounding speech
  const cleanTextForSpeech = (text: string) => {
    if (!text) return "";
    return text
      .replace(/[*#_`]/g, '') // Remove common markdown symbols
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links [text](url) to just text
      .replace(/^\s*[-•]\s+/gm, '') // Remove list bullets
      .replace(/\n{2,}/g, '. ') // Convert double newlines to pauses
      .trim();
  };

  const handleToggleRead = () => {
    // Stop reading if currently active
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      return;
    }

    // Don't try to read empty content
    if (!content) return;

    // Stop any other speech (global interruption)
    window.speechSynthesis.cancel();

    const cleanText = cleanTextForSpeech(content);
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Try to select a natural English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google US English')) || 
                           voices.find(v => v.lang.startsWith('en-US')) ||
                           voices.find(v => v.lang.startsWith('en'));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // Reset state when speech finishes
    utterance.onend = () => setIsReading(false);
    utterance.onerror = () => setIsReading(false);

    window.speechSynthesis.speak(utterance);
    setIsReading(true);
  };

  // Simple Markdown-like renderer without external libraries
  const renderFormattedContent = (text: string) => {
    if (!text) return <p className="text-slate-500 italic text-sm">No information gathered yet. Ask the agent to research this.</p>;

    // Split by lines and process
    return text.split('\n').map((line, index) => {
      const trimmed = line.trim();
      
      // Handle Bullet Points
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
        const itemText = trimmed.replace(/^[-*•]\s+/, '');
        // Check for Bold text inside bullet point
        const parts = itemText.split(/(\*\*.*?\*\*)/g);
        
        return (
          <div key={index} className="flex items-start mb-2 ml-1">
            <span className="mr-2 text-indigo-500 font-bold mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 block"></span>
            <span className="text-slate-300 text-sm leading-relaxed">
               {parts.map((part, i) => {
                   if (part.startsWith('**') && part.endsWith('**')) {
                       return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
                   }
                   return part;
               })}
            </span>
          </div>
        );
      }

      // Handle Headers (simple H3/H4)
      if (trimmed.startsWith('### ')) {
          return <h4 key={index} className="font-bold text-slate-200 mt-4 mb-2 text-sm uppercase tracking-wide">{trimmed.replace(/^###\s+/, '')}</h4>
      }
      if (trimmed.startsWith('## ')) {
          return <h3 key={index} className="font-bold text-white mt-5 mb-2 text-base">{trimmed.replace(/^##\s+/, '')}</h3>
      }

      // Handle standard paragraphs with bolding support
      if (trimmed.length > 0) {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
            <p key={index} className="mb-2 text-slate-300 text-sm leading-relaxed">
               {parts.map((part, i) => {
                   if (part.startsWith('**') && part.endsWith('**')) {
                       return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
                   }
                   return part;
               })}
            </p>
        )
      }

      // Empty lines
      return <div key={index} className="h-2"></div>;
    });
  };

  // --- STYLING LOGIC ---

  const isCard = mode === 'card';

  const containerClasses = isCard
    ? `glass-card p-6 rounded-2xl border border-white/10 transition-all hover:bg-white/5 flex flex-col h-full ${className || ''}`
    : `group relative mb-8 ${className || ''}`; // Document mode: Group for hover effects, bottom margin

  const headerClasses = isCard
    ? "flex justify-between items-center mb-4"
    : "flex justify-between items-end mb-4 border-b border-white/10 pb-2 mt-2"; // Document mode: Underlined section header

  const titleClasses = isCard
    ? "text-xs font-bold uppercase tracking-widest text-indigo-400"
    : "text-lg font-bold uppercase tracking-widest text-indigo-400"; // Document mode: Larger text

  // In document mode, controls are hidden until hover
  const controlsClasses = isCard
    ? "flex items-center gap-2"
    : "flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200";

  return (
    <div className={containerClasses}>
      <div className={headerClasses}>
        <div className="flex items-center gap-3">
            <h3 className={titleClasses}>
            {title}
            </h3>
            {content && (
              <button
                onClick={handleToggleRead}
                className={`p-1 rounded-full transition-all ${
                  isReading 
                    ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20' 
                    : 'text-slate-500 hover:text-indigo-400 hover:bg-white/5'
                } ${!isCard ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}
                title={isReading ? "Stop reading" : "Read aloud"}
              >
                {isReading ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )}
        </div>

        <div className={controlsClasses}>
            {!isEditing ? (
            <button
                onClick={() => setIsEditing(true)}
                className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 hover:bg-white/5 px-2 py-1 rounded transition-colors"
            >
                Edit
            </button>
            ) : (
            <div className="flex space-x-2">
                <button
                onClick={handleCancel}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 px-2 py-1"
                >
                Cancel
                </button>
                <button
                onClick={handleSave}
                className="text-[10px] font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded shadow-lg shadow-indigo-900/20"
                >
                Save
                </button>
            </div>
            )}
        </div>
      </div>

      {isEditing ? (
        <textarea
          value={tempContent}
          onChange={(e) => setTempContent(e.target.value)}
          className="w-full flex-1 p-3 text-sm text-slate-100 border border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none bg-slate-950/50 font-mono leading-relaxed min-h-[200px]"
        />
      ) : (
        <div className={isCard ? 'flex-1' : 'text-slate-300'}>
            {renderFormattedContent(content)}
        </div>
      )}
    </div>
  );
};