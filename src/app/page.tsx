'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Loader2, Coffee, AlertCircle, MessageSquare, MicOff, Shield, User, Globe, Send, RotateCcw, Languages } from 'lucide-react';
import { VoiceWebSocket } from '../lib/websocket-client';

type ConversationMessage = {
  role: string;
  text: string;
  translation?: string;
};

export default function Home() {
  const [status, setStatus] = useState('Initializing...');
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [respectScore, setRespectScore] = useState(50);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [pierreState, setPierreState] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'annoyed'>('idle');
  const [currentScenario, setCurrentScenario] = useState<any>(null);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [showTranslation, setShowTranslation] = useState<number | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [backgroundUrl, setBackgroundUrl] = useState<string>('');
  
  const wsRef = useRef<VoiceWebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Send message to Pierre
  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    
    console.log('[App] Sending message:', text);
    setHistory(prev => [...prev, { role: 'You', text: text.trim() }]);
    wsRef.current?.sendText(text.trim());
    setPierreState('thinking');
    setTranscript('');
    setTextInput('');
    setHints([]);
  };

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.9;
      utterance.pitch = 0.9;
      utterance.onend = () => setPierreState('idle');
      window.speechSynthesis.speak(utterance);
    }
  };

  // Initialize WebSocket
  useEffect(() => {
    const onMessage = (data: any) => {
      console.log('[WS] Received message:', data.type);
      
      if (data.type === 'ready') {
        setCurrentScenario(data.scenario);
        setRespectScore(data.respectScore);
        setStatus('Connected');
        if (data.imageUrl) setBackgroundUrl(data.imageUrl);
        
        if (data.initialGreeting) {
          setHistory([{ 
            role: data.scenario.character, 
            text: data.initialGreeting,
            translation: data.translation 
          }]);
          setHints(data.hints || []);
          setPierreState('speaking');
          speakText(data.initialGreeting);
        }
      }

      if (data.type === 'response') {
        if (data.text) {
          setHistory(prev => [...prev, { 
            role: data.character || 'AI', 
            text: data.text,
            translation: data.translation
          }]);
          setHints(data.hints || []);
          setPierreState('speaking');
          speakText(data.text);
        }
        if (data.imageUrl) setBackgroundUrl(data.imageUrl);
        setRespectScore(data.respectScore || 50);
      }
      
      if (data.type === 'error') {
        setErrorMessage(data.message);
        setPierreState('annoyed');
        setTimeout(() => setPierreState('idle'), 2000);
      }
    };

    const onStatus = (newStatus: string) => {
      setStatus(newStatus);
      if (newStatus === 'Connected') setPierreState('idle');
    };

    wsRef.current = new VoiceWebSocket(onMessage, onStatus);
    wsRef.current.connect();

    return () => {
      wsRef.current?.disconnect();
    };
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'fr-FR';
    recognition.maxAlternatives = 1;

    let silenceTimeout: any = null;
    let currentTranscript = '';

    recognition.onstart = () => {
      setIsListening(true);
      setPierreState('listening');
      currentTranscript = '';
    };
    
    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      
      currentTranscript = final || interim;
      setTranscript(currentTranscript);
      
      if (silenceTimeout) clearTimeout(silenceTimeout);
      silenceTimeout = setTimeout(() => {
        if (currentTranscript.trim()) {
          recognition.stop();
          sendMessage(currentTranscript);
        }
      }, 1500);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === 'not-allowed') setSpeechSupported(false);
      else if (event.error !== 'no-speech' && event.error !== 'aborted') setPierreState('idle');
    };

    recognition.onend = () => {
      setIsListening(false);
      if (currentTranscript.trim() && pierreState === 'listening') sendMessage(currentTranscript);
      else setPierreState(c => c === 'listening' ? 'idle' : c);
    };

    recognitionRef.current = recognition;
  }, [pierreState]);

  const toggleListening = () => {
    if (isListening) recognitionRef.current?.stop();
    else {
      setTranscript('');
      try { recognitionRef.current?.start(); } catch (e) {}
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#050505] text-[#e0e0e0] font-sans selection:bg-red-900 transition-all duration-1000 overflow-hidden relative">
      
      {/* CINEMATIC BACKGROUND */}
      <div className="absolute inset-0 z-0">
        {backgroundUrl ? (
          <img 
            src={backgroundUrl} 
            className="w-full h-full object-cover opacity-40 blur-[1px] transition-all duration-2000 scale-105"
            alt="Background"
          />
        ) : (
          <div className="w-full h-full bg-zinc-900 opacity-20"></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90"></div>
      </div>

      {/* TOP BAR */}
      <div className="w-full max-w-7xl flex justify-between items-center z-20 p-6 md:p-10 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="bg-white text-black px-4 py-1 font-black text-3xl tracking-tighter shadow-xl">RAW</div>
          <div className="h-10 w-[1px] bg-white/20 mx-2"></div>
          <div>
            <h1 className="text-xs font-bold tracking-[0.4em] uppercase text-zinc-400">Social Friction Engine</h1>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-black mt-1">
              {currentScenario?.location || 'Paris'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-12">
          <div className="hidden md:block">
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black mb-3 flex items-center gap-2">
              <Shield size={10} /> Reputation
            </p>
            <div className="flex items-center gap-4">
              <div className="w-48 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                <div 
                  className={`h-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.1)] ${respectScore > 60 ? 'bg-emerald-500' : respectScore < 30 ? 'bg-red-600' : 'bg-orange-500'}`}
                  style={{ width: `${respectScore}%` }}
                ></div>
              </div>
              <span className="text-xs font-mono text-white/60 tracking-tighter">{respectScore}%</span>
            </div>
          </div>
          
          <div className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${status === 'Connected' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-red-500/30 text-red-500 bg-red-500/5'}`}>
            {status}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-7xl flex flex-col md:flex-row gap-10 z-20 px-6 pb-6 overflow-hidden">
        
        {/* CHARACTER AREA (CINEMATIC) */}
        <div className="flex-1 flex flex-col items-center justify-center relative min-h-[400px]">
          <div className="relative group">
            {/* CHARACTER FRAME */}
            <div className={`w-[350px] h-[350px] md:w-[500px] md:h-[500px] rounded-3xl border transition-all duration-1000 flex items-center justify-center overflow-hidden bg-black/40 backdrop-blur-2xl ${
              pierreState === 'listening' ? 'border-red-500/40 scale-105 shadow-[0_0_80px_rgba(239,68,68,0.1)]' :
              pierreState === 'thinking' ? 'border-emerald-500/40 shadow-[0_0_80px_rgba(16,185,129,0.1)] animate-pulse' :
              pierreState === 'annoyed' ? 'border-orange-600 animate-shake shadow-[0_0_80px_rgba(234,88,12,0.1)]' :
              'border-white/5 shadow-2xl'
            }`}>
              {backgroundUrl ? (
                <img 
                  src={backgroundUrl} 
                  className={`w-full h-full object-cover transition-all duration-2000 ${pierreState === 'thinking' ? 'grayscale opacity-40 scale-110' : 'opacity-80 scale-100'}`} 
                />
              ) : (
                <Coffee size={120} className="text-zinc-800 opacity-20" />
              )}

              {/* OVERLAY STATUS */}
              <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center text-center px-10 space-y-2 pointer-events-none">
                {pierreState === 'thinking' && (
                  <div className="bg-emerald-500 text-black px-3 py-1 text-[10px] font-black uppercase tracking-widest animate-bounce">
                    Analyzing...
                  </div>
                )}
                {pierreState === 'listening' && (
                  <div className="bg-red-600 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest animate-pulse">
                    Listening
                  </div>
                )}
              </div>
            </div>

            {/* CINEMATIC SUBTITLES */}
            <div className="absolute -bottom-16 left-0 right-0 text-center px-4 transition-all duration-500">
              {transcript ? (
                <p className="text-2xl font-bold text-white tracking-tight drop-shadow-2xl italic opacity-80">
                  "{transcript}"
                </p>
              ) : history.length > 0 && history[history.length - 1].role !== 'You' ? (
                <div className="space-y-2">
                  <p className="text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] uppercase">
                    {history[history.length - 1].text}
                  </p>
                  {showTranslation === history.length - 1 && (
                    <p className="text-sm font-bold text-zinc-400 tracking-wide uppercase italic">
                      ({history[history.length - 1].translation})
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* LOG & INTERACTION AREA */}
        <div className="w-full md:w-[450px] flex flex-col bg-zinc-950/60 backdrop-blur-3xl border border-white/5 shadow-2xl rounded-t-[2.5rem] overflow-hidden">
          
          {/* LOG HEADER */}
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
            <span className="text-[10px] uppercase tracking-[0.4em] font-black text-zinc-500">Log</span>
            <div className="flex gap-4">
              <button 
                onClick={() => window.location.reload()}
                className="text-zinc-600 hover:text-white transition-colors"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
          
          {/* CHAT LOG */}
          <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide max-h-[400px]">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-10 text-center px-8 py-20">
                <MessageSquare size={64} className="mb-6" />
                <p className="text-sm italic font-black uppercase tracking-widest">Awaiting interaction</p>
              </div>
            ) : (
              history.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'You' ? 'items-end' : 'items-start'} animate-fade-in group`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-black">
                      {msg.role === 'You' ? 'Sub-vocal' : msg.role.toUpperCase()}
                    </span>
                    {msg.role !== 'You' && msg.translation && (
                      <button 
                        onClick={() => setShowTranslation(showTranslation === i ? null : i)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-white"
                      >
                        <Languages size={12} />
                      </button>
                    )}
                  </div>
                  <div className={`max-w-[90%] px-6 py-4 rounded-2xl transition-all duration-500 ${
                    msg.role === 'You' 
                      ? 'bg-white/5 border border-white/5 text-zinc-200 rounded-tr-none font-medium' 
                      : 'bg-white text-black font-black rounded-tl-none shadow-xl scale-105'
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    {showTranslation === i && msg.translation && (
                      <p className="mt-3 pt-3 border-t border-black/10 text-[11px] italic font-bold opacity-60">
                        {msg.translation}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* INTERACTION AREA */}
          <div className="p-6 space-y-6 border-t border-white/5 bg-black/40">
            
            {/* HINTS */}
            {hints.length > 0 && (
              <div className="flex flex-wrap gap-2 animate-fade-in">
                {hints.map((hint, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(hint)}
                    disabled={pierreState === 'thinking'}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all disabled:opacity-30"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            )}

            {/* INPUTS */}
            <div className="flex gap-4">
              <button 
                onClick={toggleListening}
                disabled={status !== 'Connected' || pierreState === 'thinking'}
                className={`p-5 rounded-2xl border transition-all duration-500 ${
                  isListening 
                    ? 'bg-red-600 border-red-500 text-white shadow-[0_0_40px_rgba(220,38,38,0.3)] animate-pulse' 
                    : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/30'
                } ${(status !== 'Connected' || pierreState === 'thinking') && 'opacity-20 cursor-not-allowed'}`}
              >
                {isListening ? <Mic size={24} /> : <MicOff size={24} />}
              </button>

              <form onSubmit={(e) => { e.preventDefault(); sendMessage(textInput); }} className="flex-1 flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={isListening ? "Listening..." : "Response..."}
                  disabled={status !== 'Connected' || pierreState === 'thinking'}
                  className="flex-1 bg-white/5 border border-white/5 rounded-2xl px-6 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-white/20 transition-all disabled:opacity-30"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || status !== 'Connected' || pierreState === 'thinking'}
                  className="bg-white text-black px-6 rounded-2xl font-black hover:bg-zinc-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xl"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-red-600 text-white p-6 rounded-2xl text-xs z-50 animate-fade-in shadow-2xl font-black uppercase tracking-[0.2em]">
          <AlertCircle size={20} />
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="ml-6 opacity-50 hover:opacity-100 transition-opacity">DISMISS</button>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
          background: #050505;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  );
}
