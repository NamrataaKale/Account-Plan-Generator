import React, { useState, useEffect } from 'react';
import { ChartProps } from '../types';

export const DataChart: React.FC<ChartProps> = ({ 
  title, 
  type, 
  data, 
  color = '#6366f1' // Default Indigo-500
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Trigger entrance animation after mount
    // Using a small delay ensures the browser paints the initial state first
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Defensive Coding: Handle empty or malformed data gracefully
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="p-4 border border-white/10 rounded-lg bg-slate-900/50 text-slate-500 text-xs font-mono text-center">
        NO DATA STREAM AVAILABLE FOR: {title}
      </div>
    );
  }

  // Dimensions
  const width = 600;
  const height = 300;
  const padding = 40;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  // Scales
  const maxValue = Math.max(...data.map(d => d.value)) || 100;
  const safeMax = maxValue * 1.1; // Add 10% headroom

  // Helper: Get X position
  const getX = (index: number) => {
    return padding + (index * (graphWidth / (data.length > 1 ? data.length - 1 : 1)));
  };

  // Helper: Get Y position (inverted for SVG)
  const getY = (value: number) => {
    return height - padding - (value / safeMax) * graphHeight;
  };

  // Helper: Bar layout
  const barSlotWidth = graphWidth / data.length;
  const barWidth = Math.min(40, barSlotWidth * 0.6);

  // Line Chart Path
  const linePath = data.length > 1 
    ? data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.value)}`).join(' ')
    : '';

  // Unique Gradient ID to prevent conflicts when multiple charts render
  const gradientId = `chartGradient-${title.replace(/[^a-zA-Z0-9]/g, '')}-${type}`;

  return (
    <div className="w-full max-w-full p-4 bg-slate-900/80 border border-white/10 rounded-2xl backdrop-blur-sm shadow-2xl my-4 overflow-hidden group">
      <div className="flex justify-between items-end mb-4 px-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            {title}
        </h3>
        <div className="text-[10px] text-slate-500 font-mono">
          MAX: {maxValue.toLocaleString()}
        </div>
      </div>
      
      <div className="relative w-full aspect-[2/1] min-h-[200px]">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Definitions for Gradients */}
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            
            {/* Clip Path for Line Wipe Animation */}
            <clipPath id={`clip-${gradientId}`}>
               <rect x="0" y="0" width={animate ? width : 0} height={height} className="transition-all duration-[1500ms] ease-out" />
            </clipPath>
          </defs>

          {/* Grid Lines (Horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = height - padding - (tick * graphHeight);
            return (
              <g key={tick}>
                <line 
                  x1={padding} 
                  y1={y} 
                  x2={width - padding} 
                  y2={y} 
                  stroke="white" 
                  strokeOpacity="0.05" 
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}

          {/* RENDER: BAR CHART */}
          {type === 'bar' && data.map((d, i) => {
            const x = padding + (i * barSlotWidth) + (barSlotWidth - barWidth) / 2;
            const y = getY(d.value);
            const h = height - padding - y;
            
            return (
              <g 
                key={i} 
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="transition-all duration-300 ease-out"
              >
                {/* Bar Rect with ScaleY Animation */}
                {/* We use transform origin bottom to make it grow upwards */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  fill={color}
                  className={`transition-all duration-1000 ease-out ${hoveredIndex !== null && hoveredIndex !== i ? 'opacity-50' : 'opacity-90'}`}
                  rx={4}
                  style={{ 
                      transformBox: 'fill-box',
                      transformOrigin: 'bottom',
                      transform: animate ? 'scaleY(1)' : 'scaleY(0)',
                      opacity: animate ? (hoveredIndex !== null && hoveredIndex !== i ? 0.5 : 0.9) : 0
                  }}
                />
                
                {/* Hover Tooltip/Label - Only shows when hovered */}
                <text
                  x={x + barWidth / 2}
                  y={y - 10}
                  textAnchor="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                  className={`transition-opacity duration-200 font-mono pointer-events-none ${hoveredIndex === i ? 'opacity-100' : 'opacity-0'}`}
                >
                  {d.value.toLocaleString()}
                </text>

                {/* X-Axis Label */}
                <text
                  x={x + barWidth / 2}
                  y={height - padding + 20}
                  textAnchor="middle"
                  fill="#94a3b8" // slate-400
                  fontSize="10"
                  className="font-medium uppercase tracking-wide"
                >
                  {d.label.length > 8 ? d.label.substring(0, 6) + '..' : d.label}
                </text>
              </g>
            );
          })}

          {/* RENDER: LINE CHART */}
          {type === 'line' && (
            <g>
              {/* Animated reveal group */}
              <g clipPath={`url(#clip-${gradientId})`}>
                {/* Area Under Curve */}
                <path
                  d={`${linePath} L ${getX(data.length - 1)} ${height - padding} L ${getX(0)} ${height - padding} Z`}
                  fill={`url(#${gradientId})`}
                  className="opacity-50"
                />
                {/* The Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="drop-shadow-lg"
                />
              </g>
              
              {/* Data Points - Fade in after line draws */}
              {data.map((d, i) => (
                <g 
                  key={i}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{ 
                      cursor: 'crosshair',
                      opacity: animate ? 1 : 0,
                      transition: `opacity 0.3s ease-out ${1 + (i * 0.1)}s` // Staggered fade in
                  }}
                >
                  {/* Subtle Pulse Effect for dots */}
                  <circle
                    cx={getX(i)}
                    cy={getY(d.value)}
                    r={hoveredIndex === i ? 6 : 4}
                    fill="#0f172a" // slate-950
                    stroke={color}
                    strokeWidth="2"
                    className="transition-all duration-200"
                  >
                      {/* Pulse Animation */}
                      <animate 
                        attributeName="r" 
                        values={hoveredIndex === i ? "6;6;6" : "4;5;4"} 
                        dur="3s" 
                        repeatCount="indefinite" 
                        begin={`${i * 0.2}s`}
                      />
                  </circle>
                  
                  {/* Hover Label */}
                  <g className={`transition-opacity duration-200 ${hoveredIndex === i ? 'opacity-100' : 'opacity-0'}`}>
                    <rect 
                      x={getX(i) - 20} 
                      y={getY(d.value) - 35} 
                      width="40" 
                      height="24" 
                      rx="4" 
                      fill="#1e293b" 
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <text
                      x={getX(i)}
                      y={getY(d.value) - 19}
                      textAnchor="middle"
                      fill="white"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {d.value}
                    </text>
                  </g>

                  {/* X-Axis Label */}
                  <text
                    x={getX(i)}
                    y={height - padding + 20}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="10"
                    className="font-medium"
                  >
                    {d.label}
                  </text>
                </g>
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};