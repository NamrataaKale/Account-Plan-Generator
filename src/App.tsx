import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChatSession } from "@google/generative-ai";
import { AccountPlan, AccountPlanKey, Message, Session, Persona, Attachment, ChartProps } from './types';
import { createChatSession } from './services/geminiService';
import { ThinkingIndicator } from './components/ThinkingIndicator';
import { AccountPlanSection } from './components/AccountPlanSection';
import { DataChart } from './components/DataChart';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SourceTooltip } from './components/SourceTooltip';

const STORAGE_KEY = 'company_scout_sessions_v3_stable';

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

const loadInitialData = (): Session[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to load sessions", e);
  }
  return [createNewSession()];
};

export default function App() {
  const [sessions, setSessions] = useState<Session[]>(loadInitialData);
  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0].id);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<Persona>('analyst');
  const [chatWidth, setChatWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [stagedAttachment, setStagedAttachment] = useState<Attachment | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState(true);
  const lastReadMessageIdRef = useRef<string | null>(null);
  const [conflictAlert, setConflictAlert] = useState<ConflictData | null>(null);

  const activeSession = useMemo(() => 
    sessions.find(s => s.id === activeSessionId) || sessions[0], 
  [sessions, activeSessionId]);

  const chatSessionsRef = useRef<Map<string, ChatSession>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Responsive logic
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarOffset = sidebarOpen && isDesktop ? 288 : 0;
      let newWidth = e.clientX - sidebarOffset;
      if (newWidth < 200) { if (!isChatCollapsed) setIsChatCollapsed(true); } 
      else {
        if (isChatCollapsed) setIsChatCollapsed(false);
        if (newWidth < 300) newWidth = 300;
        if (newWidth > window.innerWidth * 0.6) newWidth = window.innerWidth * 0.6;
        setChatWidth(newWidth);
      }
    };
    const handleMouseUp = () => { setIsResizing(false); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarOpen, isDesktop, isChatCollapsed]);

  const startResizing = (e: React.MouseEvent) => { e.preventDefault(); setIsResizing(true); };

  const analyzeForConflicts = (text: string) => {
    const triggers = ['conflict', 'contradict', 'discrepancy', 'inconsistent', 'however'];
    if (triggers.some(t => text.toLowerCase().includes(t))) {
      setConflictAlert({ detected: true, snippet: "Analysis detected contradictory data." });
      setTimeout(() => setConflictAlert(null), 10000);
    } else {
      setConflictAlert(null);
    }
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/\[\d+\]/g, '').replace(/[*#_`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^\s*[-•]\s+/gm, '').replace(/\n{2,}/g, '. ').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google US English')) || voices.find(v => v.lang.startsWith('en'));
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
  
  const toggleListening = async () => {
    window.speechSynthesis.cancel();
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) { alert("Voice not supported."); return; }
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        const initialInput = input;
        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
          const needsSpace = initialInput.length > 0 && !initialInput.endsWith(' ') && transcript.length > 0;
          setInput(initialInput + (needsSpace ? ' ' : '') + transcript);
        };
        recognitionRef.current = recognition;
        recognition.start();
    } catch (err) { alert("Mic permission needed."); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };
  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setStagedAttachment({ name: file.name, mimeType: file.type, base64: result.split(',')[1], url: result });
    };
    reader.readAsDataURL(file);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleCreateNewSession = () => {
    const newSession = createNewSession();
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };
  const handleSwitchSession = (id: string) => { setActiveSessionId(id); if (window.innerWidth < 768) setSidebarOpen(false); };
  const handleClearData = () => {
    if (confirm('Reset data?')) { localStorage.removeItem(STORAGE_KEY); window.location.reload(); }
  };

  const updatePlanSection = (sessionId: string, key: AccountPlanKey, value: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      const newPlan = { ...s.accountPlan, [key]: value };
      let newName = s.name;
      if (key === 'targetCompany' && value.trim().length > 0 && (s.name === "New Operation" || s.name === "New Session")) newName = value;
      return { ...s, accountPlan: newPlan, name: newName, lastActiveAt: Date.now() };
    }));
  };

  const addMessageToSession = (sessionId: string, message: Message) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, message], lastActiveAt: Date.now() } : s));
  };

  // Robust Message Sending with Retry Logic
  const handleSendMessage = async (textOverride?: string) => {
    window.speechSynthesis.cancel();
    const textToSend = typeof textOverride === 'string' ? textOverride : input;
    if ((!textToSend.trim() && !stagedAttachment) || isProcessing) return;

    const currentSessionId = activeSession.id;
    const currentChat = chatSessionsRef.current.get(currentSessionId);
    if (!currentChat) return;

    const userMsg: Message = { 
        id: Date.now().toString(), 
        role: 'user', 
        text: textToSend,
        attachment: stagedAttachment || undefined
    };
    
    addMessageToSession(currentSessionId, userMsg);
    if (!textOverride) { setInput(''); setStagedAttachment(null); }
    setIsProcessing(true);
    setConflictAlert(null); 

    try {
      let result;
      const MAX_RETRIES = 3;
      
      const parts = [{ text: userMsg.text }];
      if (userMsg.attachment) {
          parts.push({ inlineData: { mimeType: userMsg.attachment.mimeType, data: userMsg.attachment.base64 } } as any);
      }

      // Retry Loop
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            result = await currentChat.sendMessage(parts);
            break;
        } catch (e: any) {
            if (e.status === 429 || e.message?.includes('429')) {
                console.warn(`Hit rate limit. Retrying (${i+1}/${MAX_RETRIES})...`);
                if (i === MAX_RETRIES - 1) throw e;
                await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i))); // Exponential backoff
            } else {
                throw e;
            }
        }
      }

      if (!result) throw new Error("No response from AI");
      let response = result.response;
      
      // Handle Function Calls (Tool Usage)
      // The stable SDK exposes functionCalls() on the response object
      const functionCalls = response.functionCalls();
      
      if (functionCalls && functionCalls.length > 0) {
        let switchToNewSessionId: string | null = null;
        let generatedChartData: ChartProps | null = null;
        const functionResponses = [];

        for (const call of functionCalls) {
          const name = call.name;
          const args = call.args as any;

          if (name === 'updateAccountPlan') {
            updatePlanSection(currentSessionId, args.sectionKey, args.content);
            functionResponses.push({
              functionResponse: { name, response: { result: `Section updated.` } }
            });
          }
          else if (name === 'startNewResearch') {
            const newSession = createNewSession(args.companyName);
            newSession.accountPlan.targetCompany = args.companyName;
            setSessions(prev => [newSession, ...prev]);
            switchToNewSessionId = newSession.id;
            functionResponses.push({
              functionResponse: { name, response: { result: `Switched context.` } }
            });
          }
          else if (name === 'generateChart') {
            generatedChartData = args;
            functionResponses.push({
              functionResponse: { name, response: { result: `Chart rendered.` } }
            });
          }
        }

        if (generatedChartData) {
            addMessageToSession(currentSessionId, {
                id: 'chart-' + Date.now(), role: 'model', text: `Visualizing ${generatedChartData.title}:`, chartData: generatedChartData
            });
        }

        if (functionResponses.length > 0) {
            // Send back function responses
            result = await currentChat.sendMessage(functionResponses);
            response = result.response;
        }

        if (switchToNewSessionId) {
            setActiveSessionId(switchToNewSessionId);
            setIsProcessing(false);
            return;
        }
      }

      const responseText = response.text();
      analyzeForConflicts(responseText);

      // Check for grounding metadata (if available in this model/sdk version)
      // Note: Standard SDK 'candidates' access might be slightly different for grounding
      const sources: { title: string; uri: string }[] = [];
      if (response.candidates && response.candidates[0].groundingMetadata) {
         // This structure depends on the specific API version, handled gracefully
         const metadata = response.candidates[0].groundingMetadata as any;
         if (metadata.groundingChunks) {
            metadata.groundingChunks.forEach((c: any) => {
                if (c.web) sources.push({ title: c.web.title || 'Source', uri: c.web.uri });
            });
         }
      }

      addMessageToSession(currentSessionId, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        sources: sources.length > 0 ? sources : undefined
      });

    } catch (error: any) {
      console.error("Gemini Error:", error);
      let errorMsg = "System error. Please retry.";
      if (error.status === 429) errorMsg = "Rate limit exceeded. Please wait a moment.";
      addMessageToSession(currentSessionId, { id: Date.now().toString(), role: 'model', text: errorMsg });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleDownloadReport = () => {
    const { targetCompany, executiveSummary, financialHealth, strategicInitiatives, competitors, proposedSolution } = activeSession.accountPlan;
    const content = `ACCOUNT PLAN: ${targetCompany}\n\n1. EXECUTIVE SUMMARY\n${executiveSummary}\n\n2. FINANCIALS\n${financialHealth}\n\n3. STRATEGY\n${strategicInitiatives}\n\n4. COMPETITORS\n${competitors}\n\n5. SOLUTION\n${proposedSolution}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(targetCompany || 'PLAN').replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans relative selection:bg-indigo-500/30">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob"></div>
        <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
      </div>

      {/* SIDEBAR */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} glass-panel flex-shrink-0 transition-all duration-300 flex flex-col overflow-hidden z-20 border-r border-white/5`}>
         <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
            <h2 className="font-bold text-lg tracking-wider text-white font-mono">SCOUT.AI</h2>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
         </div>
         <div className="p-5">
             <button onClick={handleCreateNewSession} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-lg">INITIATE RESEARCH</button>
         </div>
         {conflictAlert && (
           <div className="mx-5 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{conflictAlert.snippet}</div>
         )}
         <div className="flex-1 overflow-y-auto px-3 space-y-1">
             {sessions.map((session) => (
                 <button key={session.id} onClick={() => handleSwitchSession(session.id)} className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all border ${activeSessionId === session.id ? 'bg-white/10 text-white border-white/10' : 'text-slate-400 border-transparent hover:bg-white/5'}`}>{session.name}</button>
             ))}
         </div>
         <div className="p-4 border-t border-white/5"><button onClick={handleClearData} className="w-full text-xs text-slate-500 hover:text-red-400">PURGE DATA</button></div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full relative z-10">
        {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="absolute left-4 top-4 z-30 p-2 bg-slate-900/80 rounded-lg text-white"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg></button>}
        
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            {/* CHAT */}
            <div style={{ width: isDesktop ? (isChatCollapsed ? 0 : chatWidth) : '100%' }} className={`flex flex-col border-r border-white/5 bg-slate-900/50 backdrop-blur-sm relative overflow-hidden ${isDesktop ? 'flex-shrink-0' : 'w-full'}`}>
                <div style={{ width: isDesktop ? chatWidth : '100%' }} className="flex flex-col h-full w-full">
                <div className="p-4 border-b border-white/5 bg-slate-900/40 pl-14 md:pl-4">
                  <h1 className="font-bold text-white mb-2">Research Scout (v1.5 Flash)</h1>
                  <div className="flex gap-1">
                    {PERSONAS.map(p => (
                      <button key={p.id} onClick={() => setSelectedPersona(p.id)} className={`flex-1 py-1 px-1 rounded text-[10px] font-bold uppercase ${selectedPersona === p.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:bg-white/5'}`}>{p.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {activeSession.messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[90%] rounded-2xl p-4 text-sm shadow-lg border ${msg.role === 'user' ? 'bg-indigo-600/90 text-white border-indigo-500/30' : 'bg-slate-800/80 text-slate-200 border-white/10'}`}>
                        {msg.attachment && <img src={msg.attachment.url} alt="Att" className="mb-2 rounded border border-white/10 max-h-40" />}
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        {msg.chartData && <ErrorBoundary><DataChart {...msg.chartData} /></ErrorBoundary>}
                        {msg.sources && (
                          <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-2">
                            {msg.sources.map((src, i) => <a key={i} href={src.uri} target="_blank" className="text-[10px] text-blue-400 bg-slate-950 px-2 py-1 rounded border border-white/10 truncate max-w-[100px]">{src.title}</a>)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isProcessing && <ThinkingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
                <div className={`p-4 bg-slate-900/60 border-t border-white/5 ${isDragging ? 'bg-indigo-900/40' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                    {stagedAttachment && <div className="mb-2 text-xs text-white bg-slate-800 p-1 rounded w-fit flex items-center gap-2">{stagedAttachment.name} <button onClick={() => setStagedAttachment(null)}>x</button></div>}
                    <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-hide">
                        {QUICK_ACTIONS.map((a, i) => <button key={i} onClick={() => handleSendMessage(a)} disabled={isProcessing} className="whitespace-nowrap px-3 py-1 bg-white/5 text-slate-300 text-[10px] font-bold rounded-full hover:bg-white/10">{a}</button>)}
                    </div>
                  <div className="relative">
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={isListening ? "Listening..." : "Command..."} className="w-full pr-28 pl-4 py-3 bg-slate-950 text-slate-100 border border-white/10 rounded-xl focus:border-indigo-500/50 resize-none text-sm h-12" rows={1} />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                        <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-slate-500 hover:text-white"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                        <button onClick={toggleListening} className={`p-1.5 rounded ${isListening ? 'text-red-400 animate-pulse' : 'text-slate-500 hover:text-white'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></button>
                        <button onClick={() => handleSendMessage()} disabled={!input.trim() && !stagedAttachment} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg></button>
                    </div>
                  </div>
                </div>
                </div>
            </div>

            {isDesktop && <div className="w-1 cursor-col-resize hover:bg-indigo-500 bg-white/5" onMouseDown={startResizing} />}

            {/* DOCUMENT */}
            <div className="flex-1 h-full overflow-y-auto p-8 bg-slate-950">
              <div className="max-w-4xl mx-auto min-h-[297mm] bg-slate-900 border border-white/10 shadow-2xl p-12 relative mb-24">
                <div className="mb-12 border-b border-white/10 pb-8"><h1 className="text-4xl font-bold text-white mb-2">{activeSession.accountPlan.targetCompany || "Strategic Account Plan"}</h1><p className="text-sm text-slate-400">Generated by Scout AI</p></div>
                <div className="flex flex-col gap-4">
                  <AccountPlanSection title="Executive Summary" sectionKey="executiveSummary" content={activeSession.accountPlan.executiveSummary} onUpdate={(k, v) => updatePlanSection(activeSession.id, k, v)} className="w-full" mode="document" />
                  <AccountPlanSection title="Financial Health" sectionKey="financialHealth" content={activeSession.accountPlan.financialHealth} onUpdate={(k, v) => updatePlanSection(activeSession.id, k, v)} className="w-full" mode="document" />
                  <AccountPlanSection title="Strategic Initiatives" sectionKey="strategicInitiatives" content={activeSession.accountPlan.strategicInitiatives} onUpdate={(k, v) => updatePlanSection(activeSession.id, k, v)} className="w-full" mode="document" />
                  <AccountPlanSection title="Competitors" sectionKey="competitors" content={activeSession.accountPlan.competitors} onUpdate={(k, v) => updatePlanSection(activeSession.id, k, v)} className="w-full" mode="document" />
                  <AccountPlanSection title="Proposed Solution" sectionKey="proposedSolution" content={activeSession.accountPlan.proposedSolution} onUpdate={(k, v) => updatePlanSection(activeSession.id, k, v)} className="w-full" mode="document" />
                </div>
              </div>
              <div className="fixed bottom-8 right-8 z-50"><button onClick={handleDownloadReport} className="bg-indigo-600 text-white px-5 py-3 rounded-full text-xs font-bold shadow-lg hover:-translate-y-1 transition-all">EXPORT REPORT</button></div>
            </div>
        </div>
      </div>
    </div>
  );
}
