import React from 'react';

interface Source {
  title: string;
  uri: string;
}

interface SourceTooltipProps {
  index: number;
  source: Source;
}

export const SourceTooltip: React.FC<SourceTooltipProps> = ({ index, source }) => {
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'External Source';
    }
  };

  return (
    <span className="relative inline-block group mx-0.5 align-baseline z-10">
      {/* Badge Trigger */}
      <span className="cursor-help text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-400/30 hover:bg-indigo-400/30 hover:text-white transition-all transform hover:scale-105 inline-flex items-center justify-center -translate-y-0.5">
        {index}
      </span>

      {/* Glassmorphism Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto z-50 origin-bottom">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl ring-1 ring-white/10">
          
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
              <span className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider truncate max-w-[120px]">
                {getDomain(source.uri)}
              </span>
            </div>
            <span className="text-[9px] text-slate-500 font-mono">CITATION [{index}]</span>
          </div>

          <p className="text-xs text-slate-200 font-medium mb-3 line-clamp-2 leading-relaxed">
            {source.title}
          </p>

          <a
            href={source.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full text-[10px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-200 hover:text-white py-2 rounded-lg transition-colors font-bold uppercase tracking-wide border border-indigo-500/20"
          >
            Visit Source
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          {/* Tooltip Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-slate-900 border-r border-b border-white/10"></div>
        </div>
      </div>
    </span>
  );
};