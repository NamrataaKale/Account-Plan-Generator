import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Chat, GenerateContentResponse, Part } from "@google/genai";
import { AccountPlan, AccountPlanKey, Message, Session, Persona, Attachment, ChartProps } from './types';
import { createChatSession } from './services/geminiService';
import { ThinkingIndicator } from './components/ThinkingIndicator';
import { AccountPlanSection } from './components/AccountPlanSection';
import { DataChart } from './components/DataChart';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SourceTooltip } from './components/SourceTooltip';

// --- Constants & Initial States ---

const STORAGE_KEY = 'company_scout_sessions_v3_modal';

const INITIAL_PLAN: AccountPlan = {
  targetCompany: '',
  executiveSummary: '',
  financialHealth: '',
  strategicInitiatives: '',
  competitors: '',
  proposedSolution: '',
};

const createInitialMessage = (): Message => ({
  id: 'init-' + Date.now(),
  role: 'model',
  text: "Systems online. Ready to initiate target analysis. Identify the company or upload a report."
});

const createNewSession = (name: string = "New Operation"): Session => ({
  id: crypto.randomUUID(),
  name,
  messages: [createInitialMessage()],
  accountPlan: { ...INITIAL_PLAN },
  createdAt: Date.now(),
  lastActiveAt: Date.now(),
});

const QUICK_ACTIONS = [
  "Analyze Financials",
  "Find Competitors",
  "Strategic Risks",
  "Sales Angle"
];

const PERSONAS: { id: Persona; label: string; icon: React.ReactNode; desc: string }[] = [
  { 
    id: 'analyst', 
    label: 'Analyst', 
    desc: 'Data-driven & Skeptical',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  },
  { 
    id: 'hustler', 
    label: 'Hustler', 
    desc: 'Growth & ROI Focused',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  },
  { 
    id: 'casual', 
    label: 'Friend', 
    desc: 'Simple & Plain English',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
  }
];

interface ConflictData {
  detected: boolean;
  snippet: string;
}

// Helper to load data initially
const loadInitialData = (): Session[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load sessions from storage", e);
  }
  return [createNewSession()];
};

export default function App() {
  // --- State ---
  const [sessions, setSessions] = useState<Session[]>(loadInitialData);
  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0].id);
  
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<Persona>('analyst');
  
  // Resizable Layout State
  const [chatWidth, setChatWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  // File Upload State
  const [stagedAttachment, setStagedAttachment] = useState<Attachment | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice & Audio
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState(true);
  const lastReadMessageIdRef = useRef<string | null>(null);

  // Agentic Smarts
  const [conflictAlert, setConflictAlert] = useState<ConflictData | null>(null);

  // Derived State
  const activeSession = useMemo(() => 
    sessions.find(s => s.id === activeSessionId) || sessions[0], 
  [sessions, activeSessionId]);

  // Refs
  const chatSessionsRef = useRef<Map<string, Chat>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession.messages, isProcessing]);

  useEffect(() => {
    chatSessionsRef.current.set(
      activeSessionId, 
      createChatSession(selectedPersona, activeSession.messages)
    );
  }, [activeSessionId, selectedPersona, activeSession.messages.length === 0]); 

  // Responsive & Resize Logic
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarOffset = sidebarOpen && isDesktop ? 288 : 0; // 288px = w-72
      let newWidth = e.clientX - sidebarOffset;
      
      const maxAllowed = window.innerWidth * 0.6;
      const collapseThreshold = 200; 
      const minEffectiveWidth = 300; 

      if (newWidth < collapseThreshold) {
        if (!isChatCollapsed) setIsChatCollapsed(true);
      } else {
        if (isChatCollapsed) setIsChatCollapsed(false);
        if (newWidth < minEffectiveWidth) newWidth = minEffectiveWidth;
        if (newWidth > maxAllowed) newWidth = maxAllowed;
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, sidebarOpen, isDesktop, isChatCollapsed]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // --- Logic: Conflict Detection ---
  const analyzeForConflicts = (text: string) => {
    const triggers = ['conflict', 'contradict', 'discrepancy', 'however, other sources', 'different source says', 'inconsistent'];
    const lowerText = text.toLowerCase();
    
    if (triggers.some(t => lowerText.includes(t))) {
      setConflictAlert({
        detected: true,
        snippet: "Intelligence analysis detected contradictory data points across sources."
      });
      setTimeout(() => setConflictAlert(null), 10000);
    } else {
      setConflictAlert(null);
    }
  };

  // --- Logic: TTS ---
  const cleanTextForSpeech = (text: string) => {
    return text
      .replace(/\[\d+\]/g, '') // Remove [1], [2] citations for speech
      .replace(/[*#_`]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*[-•]\s+/gm, '')
      .replace(/\n{2,}/g, '. ')
      .trim();
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = cleanTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google US English')) || 
                           voices.find(v => v.lang.startsWith('en-US')) ||
                           voices.find(v => v.lang.startsWith('en'));
    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!isSpeakingEnabled) return;
    const lastMsg = activeSession.messages[activeSession.messages.length - 1];
    if (lastMsg && lastMsg.role === 'model' && lastReadMessageIdRef.current !== lastMsg.id) {
      lastReadMessageIdRef.current = lastMsg.id;
      speakText(lastMsg.text);
    }
  }, [activeSession.messages, isSpeakingEnabled]);

  const toggleSpeakingEnabled = () => {
    const newState = !isSpeakingEnabled;
    setIsSpeakingEnabled(newState);
    if (!newState) window.speechSynthesis.cancel();
  };
  
  // --- Logic: Voice Input ---
  const toggleListening = async () => {
    window.speechSynthesis.cancel();
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
          alert("Voice input is not supported in this browser.");
          return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        const initialInput = input;
        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          const needsSpace = initialInput.length > 0 && !initialInput.endsWith(' ') && transcript.length > 0;
          setInput(initialInput + (needsSpace ? ' ' : '') + transcript);
        };
        recognition.onerror = (event: any) => {
            console.warn("Speech error:", event.error);
            setIsListening(false);
        };
        recognitionRef.current = recognition;
        recognition.start();
    } catch (err) {
        console.error("Mic permission denied:", err);
        alert("Microphone permission needed for voice input.");
    }
  };

  // --- Logic: File Handling ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1]; // Strip "data:image/xyz;base64,"
      setStagedAttachment({
        name: file.name,
        mimeType: file.type,
        base64: base64,
        url: result
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type === 'text/plain') {
        processFile(file);
      } else {
        alert("Please upload an image file.");
      }
    }
  };

  // --- Logic: Chat & Tooling ---

  const handleCreateNewSession = () => {
    const newSession = createNewSession();
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSwitchSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleClearData = () => {
    if (confirm('Reset all intelligence data?')) {
        window.speechSynthesis.cancel();
        localStorage.removeItem(STORAGE_KEY);
        const newSession = createNewSession();
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        chatSessionsRef.current.clear();
        window.location.reload();
    }
  };

  const updateSessionState = (sessionId: string, updates: Partial<Session>) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, ...updates, lastActiveAt: Date.now() } : s
    ));
  };

  const updatePlanSection = (sessionId: string, key: AccountPlanKey, value: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      
      const newPlan = { ...s.accountPlan, [key]: value };
      let newName = s.name;
      if (key === 'targetCompany' && value.trim().length > 0 && s.name === "New Operation") {
        newName = `${value}`;
      } else if (key === 'targetCompany' && value.trim().length > 0) {
         newName = value;
      }
      return { ...s, accountPlan: newPlan, name: newName, lastActiveAt: Date.now() };
    }));
  };

  const addMessageToSession = (sessionId: string, message: Message) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, messages: [...s.messages, message], lastActiveAt: Date.now() } 
        : s
    ));
  };

  const handleSendMessage = async (textOverride?: string) => {
    window.speechSynthesis.cancel();
    const textToSend = typeof textOverride === 'string' ? textOverride : input;
    
    // Prevent sending if empty AND no attachment
    if ((!textToSend.trim() && !stagedAttachment) || isProcessing) return;

    const currentSessionId = activeSession.id;
    const currentChat = chatSessionsRef.current.get(currentSessionId);
    if (!currentChat) return;

    // Construct User Message
    const userMsg: Message = { 
        id: Date.now().toString(), 
        role: 'user', 
        text: textToSend,
        attachment: stagedAttachment || undefined
    };
    
    addMessageToSession(currentSessionId, userMsg);
    
    if (!textOverride) {
        setInput('');
        setStagedAttachment(null);
    }
    
    setIsProcessing(true);
    setConflictAlert(null); 

    try {
      let response: GenerateContentResponse;
      
      if (userMsg.attachment) {
          response = await currentChat.sendMessage({
              message: [
                  { text: userMsg.text },
                  { inlineData: { mimeType: userMsg.attachment.mimeType, data: userMsg.attachment.base64 } }
              ]
          });
      } else {
          response = await currentChat.sendMessage({ message: userMsg.text });
      }
      
      // Loop for tool calls
      while (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponses = [];
        let switchToNewSessionId: string | null = null;
        let generatedChartData: ChartProps | null = null;

        for (const call of response.functionCalls) {
          if (call.name === 'updateAccountPlan') {
            const args = call.args as { sectionKey: AccountPlanKey, content: string };
            updatePlanSection(currentSessionId, args.sectionKey, args.content);
            functionResponses.push({
              id: call.id, name: call.name, response: { result: `Section '${args.sectionKey}' updated.` }
            });
          }
          else if (call.name === 'startNewResearch') {
            const args = call.args as { companyName: string };
            const newSession = createNewSession(args.companyName);
            newSession.accountPlan.targetCompany = args.companyName;
            newSession.messages.push({
                id: 'sys-switch-' + Date.now(), role: 'model',
                text: `Research vector initialized for ${args.companyName}.`
            });
            setSessions(prev => [newSession, ...prev]);
            switchToNewSessionId = newSession.id;
            functionResponses.push({
              id: call.id, name: call.name, response: { result: `Context switched.` }
            });
          }
          else if (call.name === 'generateChart') {
            const args = call.args as unknown as ChartProps;
            generatedChartData = args;
            functionResponses.push({
              id: call.id, name: call.name, response: { result: `Chart rendered to user interface.` }
            });
          }
        }

        // If chart was generated, add a visual message immediately
        if (generatedChartData) {
            addMessageToSession(currentSessionId, {
                id: 'chart-' + Date.now(),
                role: 'model',
                text: `Visualizing ${generatedChartData.title}:`,
                chartData: generatedChartData
            });
        }

        if (functionResponses.length > 0) {
            const parts: Part[] = functionResponses.map(fr => ({
                functionResponse: { name: fr.name, response: fr.response, id: fr.id }
            }));
            response = await currentChat.sendMessage({ message: parts });
        }

        if (switchToNewSessionId) {
            setActiveSessionId(switchToNewSessionId);
            setIsProcessing(false);
            return;
        }
      }

      const responseText = response.text || "Analysis updated.";
      
      analyzeForConflicts(responseText);

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .flatMap(chunk => chunk.web ? [{ title: chunk.web.title || 'Source', uri: chunk.web.uri || '#' }] : [])
        .filter((v, i, a) => a.findIndex(t => t.uri === v.uri) === i);

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        sources: sources.length > 0 ? sources : undefined
      };

      addMessageToSession(currentSessionId, modelMsg);

    } catch (error) {
      console.error("Error:", error);
      addMessageToSession(currentSessionId, { id: Date.now().toString(), role: 'model', text: "System error. Re-engage." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDownloadReport = () => {
    const { targetCompany, executiveSummary, financialHealth, strategicInitiatives, competitors, proposedSolution } = activeSession.accountPlan;
    const content = `ACCOUNT INTELLIGENCE: ${targetCompany || 'Untitled'}\n\n1. EXEC SUMMARY\n${executiveSummary}\n\n2. FINANCIALS\n${financialHealth}\n\n3. STRATEGY\n${strategicInitiatives}\n\n4. COMPETITORS\n${competitors}\n\n5. PROPOSED ANGLE\n${proposedSolution}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SCOUT_INTEL_${(targetCompany || 'PLAN').replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Helpers: Message Rendering with X-Ray Citations ---
  
  const renderMessageTextWithCitations = (text: string, sources?: { title: string; uri: string }[]) => {
    // If no sources, just render the text normally
    if (!sources || sources.length === 0) {
        return <p className="whitespace-pre-wrap font-light">{text}</p>;
    }

    // Split text by citations like [1], [12], etc.
    const parts = text.split(/(\[\d+\])/g);

    return (
        <p className="whitespace-pre-wrap font-light">
            {parts.map((part, i) => {
                const match = part.match(/^\[(\d+)\]$/);
                if (match) {
                    const index = parseInt(match[1]);
                    // Map citation [1] to sources[0]
                    const source = sources[index - 1];
                    if (source) {
                        return <SourceTooltip key={i} index={index} source={source} />;
                    }
                    // If no source matches the index, fall through to default text
                }
                return <span key={i}>{part}</span>;
            })}
        </p>
    );
  };

  // --- Render Components ---

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans relative selection:bg-indigo-500/30">
      
      {/* Ambient Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob"></div>
        <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
      </div>

      {/* SIDEBAR */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} glass-panel flex-shrink-0 transition-all duration-300 ease-in-out flex flex-col overflow-hidden z-20 border-r border-white/5 relative`}>
         <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                <h2 className="font-bold text-lg tracking-wider text-white font-mono">SCOUT.AI</h2>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
         </div>
         
         <div className="p-5">
             <button 
                onClick={handleCreateNewSession}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-3 px-4 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-900/40 hover:shadow-indigo-900/60 transform hover:scale-[1.02]"
             >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
                INITIATE RESEARCH
             </button>
         </div>

         {/* Conflict Alert */}
         {conflictAlert && (
           <div className="mx-5 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex flex-col gap-2 animate-bounce" style={{ animationDuration: '3s' }}>
             <div className="flex items-center gap-2 text-red-400">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
               <span className="text-xs font-bold uppercase tracking-wider">Conflict Detected</span>
             </div>
             <p className="text-xs text-red-200/80">{conflictAlert.snippet}</p>
           </div>
         )}

         <div className="flex-1 overflow-y-auto px-3 space-y-1 py-2">
             <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 mb-2">Operations</div>
             {sessions.map((session) => (
                 <button
                    key={session.id}
                    onClick={() => handleSwitchSession(session.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all border ${
                        activeSessionId === session.id 
                        ? 'bg-white/10 text-white border-white/10 shadow-lg backdrop-blur-sm' 
                        : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
                    }`}
                 >
                    <div className="font-medium truncate">{session.name}</div>
                    <div className="text-[10px] uppercase tracking-wide opacity-50 mt-1">
                        {new Date(session.lastActiveAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                 </button>
             ))}
         </div>

         <div className="p-4 border-t border-white/5">
            <button 
                onClick={handleClearData}
                className="w-full text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center justify-center gap-1 opacity-60 hover:opacity-100"
            >
                PURGE SYSTEM DATA
            </button>
         </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full relative z-10">
        
        {!sidebarOpen && (
             <button 
                onClick={() => setSidebarOpen(true)}
                className="absolute left-4 top-4 z-30 p-2 bg-slate-900/80 backdrop-blur text-white rounded-lg border border-white/10 hover:bg-slate-800"
             >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
             </button>
        )}

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            
            {/* EXPAND CHAT BUTTON (When Minimized) */}
            {isDesktop && isChatCollapsed && (
                <button
                    onClick={() => setIsChatCollapsed(false)}
                    className="absolute left-0 top-24 z-50 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-r-lg shadow-lg shadow-indigo-900/20 transition-all border border-l-0 border-white/20"
                    title="Expand Chat"
                >
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </button>
            )}

            {/* CHAT INTERFACE */}
            <div 
                style={{ width: isDesktop ? (isChatCollapsed ? 0 : chatWidth) : '100%' }}
                className={`flex flex-col border-r border-white/5 bg-slate-900/50 backdrop-blur-sm relative overflow-hidden
                    ${isResizing ? 'pointer-events-none select-none' : ''} 
                    ${!isResizing && isDesktop ? 'transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]' : ''}
                    ${isDesktop ? 'flex-shrink-0' : 'w-full'}
                `}
            >
                {/* 
                   Inner Container locked to width. 
                   Prevents content reflow during collapse animation. 
                */}
                <div style={{ width: isDesktop ? chatWidth : '100%' }} className="flex flex-col h-full w-full">
                
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex flex-col space-y-3 bg-slate-900/40 pl-14 md:pl-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                      AI
                    </div>
                    <div>
                      <h1 className="font-bold text-white tracking-tight">Research Scout</h1>
                      <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                          <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono">Online</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex p-1 bg-slate-950/50 rounded-lg border border-white/5">
                    {PERSONAS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPersona(p.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all ${
                          selectedPersona === p.id 
                            ? 'bg-white/10 text-white shadow-sm border border-white/10' 
                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                        }`}
                        title={p.desc}
                      >
                        {p.icon}
                        <span className="hidden sm:inline">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                  {activeSession.messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[90%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg backdrop-blur-sm border ${
                          msg.role === 'user'
                            ? 'bg-indigo-600/90 text-white rounded-tr-none border-indigo-500/30 shadow-indigo-900/20'
                            : 'bg-slate-800/80 text-slate-200 rounded-tl-none border-white/10'
                        }`}
                      >
                        {/* Render Attached Image if exists */}
                        {msg.attachment && (
                            <div className="mb-3 rounded-lg overflow-hidden border border-white/20">
                                <img src={msg.attachment.url} alt="Attachment" className="max-w-full h-auto" />
                            </div>
                        )}
                        
                        {/* Render Message Text with Inline X-Ray Citations */}
                        {renderMessageTextWithCitations(msg.text, msg.sources)}
                        
                        {/* Render Chart if exists, Wrapped in ErrorBoundary */}
                        {msg.chartData && (
                            <div className="mt-4">
                                <ErrorBoundary>
                                    <DataChart {...msg.chartData} />
                                </ErrorBoundary>
                            </div>
                        )}

                        {/* Fallback Citation List (Footer) */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Verified Sources</p>
                            <div className="flex flex-wrap gap-2">
                              {msg.sources.map((src, idx) => (
                                <a key={idx} href={src.uri} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-slate-950/50 border border-white/10 text-blue-400 hover:text-blue-300 hover:border-blue-400 transition-colors truncate max-w-[150px]"
                                >
                                  <span className="opacity-50 font-mono">[{idx + 1}]</span>
                                  <span className="truncate">{src.title}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isProcessing && <div className="flex justify-start"><ThinkingIndicator /></div>}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div 
                    className={`p-4 bg-slate-900/60 border-t border-white/5 backdrop-blur-md transition-all ${isDragging ? 'bg-indigo-900/40 border-indigo-500 border-dashed' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {isDragging && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                            <p className="text-indigo-400 font-bold text-lg animate-pulse">Drop to analyze file</p>
                        </div>
                    )}

                    {/* Staged Attachment Preview */}
                    {stagedAttachment && (
                        <div className="mb-2 flex items-center gap-2 p-2 bg-slate-800/80 rounded-lg border border-white/10 w-fit">
                            <div className="w-10 h-10 rounded overflow-hidden bg-black">
                                <img src={stagedAttachment.url} alt="preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-white truncate max-w-[150px]">{stagedAttachment.name}</span>
                                <span className="text-[10px] text-slate-400">Ready to upload</span>
                            </div>
                            <button onClick={() => setStagedAttachment(null)} className="ml-2 text-slate-500 hover:text-red-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide mask-linear-fade">
                        {QUICK_ACTIONS.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSendMessage(action)}
                                disabled={isProcessing}
                                className="whitespace-nowrap px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider rounded-full transition-all border border-white/5 hover:border-white/20"
                            >
                                {action}
                            </button>
                        ))}
                    </div>

                  <div className="relative group">
                    <div className={`absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl opacity-20 group-hover:opacity-50 transition duration-500 ${isListening ? 'opacity-100 animate-pulse' : ''}`}></div>
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={isListening ? "Listening..." : "Enter command or drop image..."}
                      className="relative w-full pr-32 pl-4 py-3.5 bg-slate-950 text-slate-100 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 resize-none text-sm h-14 max-h-32 shadow-inner"
                      rows={1}
                    />
                    
                    {/* Input Controls */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                        
                        {/* File Upload Button */}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all"
                          title="Attach file"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf,text/plain" />

                        <button
                          onClick={toggleSpeakingEnabled}
                          className={`p-2 rounded-lg transition-all ${isSpeakingEnabled ? 'text-indigo-400 hover:bg-indigo-400/10' : 'text-slate-600 hover:text-slate-400'}`}
                        >
                          {isSpeakingEnabled ? (
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                          ) : (
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                          )}
                        </button>

                        <button
                          onClick={toggleListening}
                          className={`p-2 rounded-lg transition-all ${isListening ? 'text-red-400 bg-red-400/10 animate-pulse' : 'text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10'}`}
                        >
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        </button>

                        <button
                          onClick={() => handleSendMessage()}
                          disabled={(!input.trim() && !stagedAttachment) || isProcessing}
                          className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-30 disabled:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-600/20"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                        </button>
                    </div>
                  </div>
                </div>
                </div>
            </div>

            {/* RESIZER HANDLE */}
            {isDesktop && (
                <div
                    className={`w-1 cursor-col-resize hover:bg-indigo-500 transition-colors z-40 flex-shrink-0 relative group flex items-center justify-center ${isResizing ? 'bg-indigo-500' : 'bg-white/5'}`}
                    onMouseDown={startResizing}
                >
                     {/* Visual Grip */}
                     <div className={`w-1 h-8 rounded-full bg-white/20 group-hover:bg-white/50 transition-all ${isResizing ? 'bg-white' : ''}`} />
                </div>
            )}

            {/* DOCUMENT PANEL (PAPER VIEW) */}
            <div className="flex-1 h-full overflow-y-auto p-4 md:p-6 lg:p-8 relative scroll-smooth bg-slate-950">
              {/* Paper Page Container */}
              <div className="max-w-4xl mx-auto min-h-[297mm] bg-slate-900 border border-white/10 shadow-2xl p-12 relative mb-24 transition-all duration-300">
                
                {/* Watermark */}
                <div className="absolute top-12 right-12 text-[10px] font-mono text-slate-600 border border-slate-700 px-2 py-1 rounded uppercase tracking-widest opacity-50">
                    Confidential // AI Generated
                </div>

                {/* Report Header */}
                <div className="mb-12 border-b border-white/10 pb-8">
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2 leading-tight">
                        {activeSession.accountPlan.targetCompany || "Strategic Account Plan"}
                    </h1>
                    <p className="text-sm text-slate-400 font-mono">
                        Generated by Scout AI • {new Date().toLocaleDateString()}
                    </p>
                </div>

                {/* Content Sections - Rendered as Document Flow */}
                <div className="flex flex-col gap-2">
                  <ErrorBoundary>
                    <AccountPlanSection 
                        title="Executive Summary" 
                        sectionKey="executiveSummary"
                        content={activeSession.accountPlan.executiveSummary}
                        onUpdate={(k, v) => updatePlanSection(activeSession.id, k, v)}
                        className="w-full"
                        mode="document"
                    />
                  </ErrorBoundary>

                  <ErrorBoundary>
                    <AccountPlanSection 
                        title="Financial Health" 
                        sectionKey="financialHealth"
                        content={activeSession.accountPlan.financialHealth}
                        onUpdate={(k, v) => updatePlanSection(activeSession.id, k, v)}
                        className="w-full"
                        mode="document"
                    />
                  </ErrorBoundary>

                  <ErrorBoundary>
                    <AccountPlanSection 
                        title="Strategic Initiatives" 
                        sectionKey="strategicInitiatives"
                        content={activeSession.accountPlan.strategicInitiatives}
                        onUpdate={(k, v) => updatePlanSection(activeSession.id, k, v)}
                        className="w-full"
                        mode="document"
                    />
                  </ErrorBoundary>

                  <ErrorBoundary>
                    <AccountPlanSection 
                        title="Competitors" 
                        sectionKey="competitors"
                        content={activeSession.accountPlan.competitors}
                        onUpdate={(k, v) => updatePlanSection(activeSession.id, k, v)}
                        className="w-full"
                        mode="document"
                    />
                  </ErrorBoundary>

                  <ErrorBoundary>
                    <AccountPlanSection 
                        title="Proposed Solution" 
                        sectionKey="proposedSolution"
                        content={activeSession.accountPlan.proposedSolution}
                        onUpdate={(k, v) => updatePlanSection(activeSession.id, k, v)}
                        className="w-full"
                        mode="document"
                    />
                  </ErrorBoundary>
                </div>
                
                {/* Report Footer */}
                <div className="mt-24 pt-8 border-t border-white/5 text-center">
                    <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest">
                        End of Report • {activeSession.id.split('-')[0]}
                    </p>
                </div>
              </div>
              
              {/* Floating Export Action */}
              <div className="fixed bottom-8 right-8 z-50">
                  <button 
                      onClick={handleDownloadReport}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 px-5 py-3 rounded-full text-xs font-bold uppercase tracking-wide transition-all hover:-translate-y-1"
                  >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Export Report
                  </button>
              </div>

            </div>

        </div>
      </div>
    </div>
  );
}