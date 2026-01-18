'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Loader2, Coffee, AlertCircle, MessageSquare, MicOff, Shield, User, Globe, Send } from 'lucide-react';
import { VoiceWebSocket } from '../lib/websocket-client';

type ConversationMessage = {
  role: string;
  text: string;
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
  
  const wsRef = useRef<VoiceWebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Send message to Pierre
  const sendMessage = (text: string) => {
    if (!text.trim()) {
      console.log('[App] Empty text, not sending');
      return;
    }
    
    console.log('[App] Sending message:', text);
    console.log('[App] WebSocket ref:', wsRef.current ? 'exists' : 'null');
    setHistory(prev => [...prev, { role: 'You', text: text.trim() }]);
    wsRef.current?.sendText(text.trim());
    setPierreState('thinking');
    setTranscript('');
    setTextInput('');
  };

  // Initialize WebSocket
  useEffect(() => {
    const onMessage = (data: any) => {
      console.log('[WS] Received message:', data.type);
      if (data.type === 'ready') {
        setCurrentScenario(data.scenario);
        setRespectScore(data.respectScore);
        setStatus('Connected');
      }

      if (data.type === 'response') {
        if (data.text) {
          setHistory(prev => [...prev, { role: data.character || 'AI', text: data.text }]);
          // Speak Pierre's response
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(data.text);
            utterance.lang = 'fr-FR';
            utterance.rate = 0.9;
            utterance.pitch = 0.9;
            utterance.onend = () => setPierreState('idle');
            window.speechSynthesis.speak(utterance);
          }
        }
        setRespectScore(data.respectScore || 50);
        setPierreState('speaking');
      }
      
      if (data.type === 'error') {
        console.error('[WS] Error:', data.message);
        setErrorMessage(data.message);
        setPierreState('annoyed');
        setTimeout(() => setPierreState('idle'), 2000);
      }
    };

    const onStatus = (newStatus: string) => {
      console.log('[WS] Status:', newStatus);
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
      console.warn('[Speech] Not supported in this browser');
      setSpeechSupported(false);
      return;
    }

    console.log('[Speech] Initializing...');
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let silenceTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentTranscript = '';

    recognition.onstart = () => {
      console.log('[Speech] Started');
      setIsListening(true);
      setPierreState('listening');
      currentTranscript = '';
    };
    
    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      
      currentTranscript = final || interim;
      setTranscript(currentTranscript);
      console.log('[Speech] Transcript:', currentTranscript);
      
      // Reset silence timeout
      if (silenceTimeout) clearTimeout(silenceTimeout);
      silenceTimeout = setTimeout(() => {
        if (currentTranscript.trim()) {
          console.log('[Speech] Auto-sending after silence');
          recognition.stop();
          sendMessage(currentTranscript);
        }
      }, 1500); // 1.5 seconds of silence
    };

    recognition.onerror = (event: any) => {
      console.error('[Speech] Error:', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        setErrorMessage('Microphone access denied. Use the text input below.');
        setSpeechSupported(false);
      } else if (event.error === 'no-speech') {
        // No speech detected - just quietly end
        setPierreState('idle');
      } else if (event.error !== 'aborted') {
        console.warn('[Speech] Error:', event.error);
      }
    };

    recognition.onend = () => {
      console.log('[Speech] Ended');
      setIsListening(false);
      if (silenceTimeout) clearTimeout(silenceTimeout);
      
      // If we have unsent transcript, send it
      if (currentTranscript.trim() && pierreState === 'listening') {
        sendMessage(currentTranscript);
      } else {
        setPierreState(current => current === 'listening' ? 'idle' : current);
      }
    };

    recognitionRef.current = recognition;
    console.log('[Speech] Ready');
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setErrorMessage('Speech not available. Use the text input.');
      return;
    }

    if (isListening) {
      console.log('[Speech] Manual stop');
      recognitionRef.current.stop();
    } else {
      console.log('[Speech] Starting...');
      setTranscript('');
      setErrorMessage(null);
      try {
        recognitionRef.current.start();
      } catch (e: any) {
        console.error('[Speech] Start error:', e.message);
        if (e.message?.includes('already started')) {
          recognitionRef.current.stop();
          setTimeout(() => {
            try { recognitionRef.current?.start(); } catch {}
          }, 100);
        } else {
          setErrorMessage('Could not start microphone. Use text input.');
        }
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Form] Submit clicked, text:', textInput, 'status:', status);
    if (textInput.trim() && status === 'Connected') {
      console.log('[Form] Sending...');
      sendMessage(textInput);
    } else {
      console.log('[Form] Not sending - empty text or not connected');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-[#050505] text-[#e0e0e0] font-sans selection:bg-red-900 transition-all duration-1000 overflow-hidden">
      
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="w-full h-full bg-zinc-900 opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90"></div>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-red-950/10 blur-[150px] rounded-full transition-all duration-1000 ${pierreState === 'listening' ? 'scale-125 opacity-40' : 'scale-100 opacity-20'}`}></div>
      </div>

      {/* Header */}
      <div className="w-full max-w-6xl flex justify-between items-center z-20 border-b border-white/5 pb-8 mb-12 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="bg-white text-black px-3 py-1 font-black text-2xl tracking-tighter">RAW</div>
          <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.3em] uppercase text-zinc-400">Social Friction Engine</h1>
            <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mt-1">
              {currentScenario?.location || 'Loading...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="hidden md:block">
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black mb-2 flex items-center gap-2">
              <Shield size={10} /> Reputation
            </p>
            <div className="flex items-center gap-3">
              <div className="w-32 h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${respectScore > 60 ? 'bg-emerald-500' : respectScore < 30 ? 'bg-red-600' : 'bg-orange-500'}`}
                  style={{ width: `${respectScore}%` }}
                ></div>
              </div>
              <span className="text-xs font-mono text-white/60">{respectScore}%</span>
            </div>
          </div>
          
          {speechSupported && (
            <button 
              onClick={toggleListening}
              disabled={status !== 'Connected' || pierreState === 'thinking'}
              className={`group relative p-5 rounded-xl border transition-all active:scale-95 ${
                isListening 
                  ? 'bg-red-600 border-red-500 text-white shadow-[0_0_30px_rgba(220,38,38,0.4)] animate-pulse' 
                  : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20'
              } ${(status !== 'Connected' || pierreState === 'thinking') && 'opacity-30 cursor-not-allowed'}`}
            >
              {isListening ? <Mic size={28} /> : <MicOff size={28} />}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 w-full max-w-6xl flex flex-col md:flex-row gap-16 z-20">
        
        {/* Interaction Area */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-12">
          <div className="relative">
            <div className={`w-64 h-64 rounded-2xl border transition-all duration-700 flex items-center justify-center overflow-hidden bg-black/40 backdrop-blur-xl ${
              pierreState === 'listening' ? 'border-red-500/50 scale-105 shadow-[0_0_60px_rgba(239,68,68,0.15)]' :
              pierreState === 'speaking' ? 'border-emerald-500/50 shadow-[0_0_60px_rgba(16,185,129,0.15)]' :
              pierreState === 'thinking' ? 'border-yellow-500/50' :
              pierreState === 'annoyed' ? 'border-orange-600 animate-shake' : 'border-white/5'
            }`}>
              <Coffee size={100} className="text-zinc-800" />
            </div>
            
            {pierreState === 'thinking' && (
              <div className="absolute -top-6 -right-6 bg-white text-black p-4 rounded-xl shadow-2xl animate-bounce">
                <Loader2 className="animate-spin" size={24} />
              </div>
            )}
          </div>

          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
              {pierreState === 'listening' ? 'Listening...' :
               pierreState === 'thinking' ? 'Pierre is thinking...' :
               pierreState === 'speaking' ? `${currentScenario?.character || 'Pierre'} responds` :
               pierreState === 'annoyed' ? 'Hmph!' : 'Talk to Pierre'}
            </h2>
            
            {transcript && (
              <p className="text-lg text-zinc-400 italic">"{transcript}"</p>
            )}
            
            <div className="flex justify-center gap-4 text-[10px] uppercase tracking-widest font-bold text-zinc-500">
              <span className="flex items-center gap-1"><Globe size={12} /> {currentScenario?.location || 'Paris'}</span>
              <span className="flex items-center gap-1"><User size={12} /> {currentScenario?.character || 'Pierre'}</span>
            </div>
          </div>
        </div>

        {/* Chat / Transcript Area */}
        <div className="w-full md:w-[480px] flex flex-col bg-zinc-950/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-zinc-400">Conversation</span>
            <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${status === 'Connected' ? 'bg-emerald-600/10 text-emerald-500' : 'bg-red-600/10 text-red-500'}`}>
              {status}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide max-h-[400px]">
            {history.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-8 py-20">
                <MessageSquare size={48} className="mb-6" />
                <p className="text-sm italic font-serif">"Type below or use the microphone"</p>
              </div>
            )}
            
            {history.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'You' ? 'items-end' : 'items-start'} animate-fade-in`}>
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-black mb-2">
                  {msg.role === 'You' ? 'YOU' : (currentScenario?.character?.toUpperCase() || 'PIERRE')}
                </span>
                <div className={`max-w-[90%] px-5 py-4 rounded-xl ${
                  msg.role === 'You' 
                    ? 'bg-zinc-800/80 text-zinc-200 rounded-tr-none' 
                    : 'bg-white text-black font-bold rounded-tl-none'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Text Input */}
          <form onSubmit={handleTextSubmit} className="p-4 border-t border-white/5 bg-black/20">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type to Pierre..."
                disabled={status !== 'Connected' || pierreState === 'thinking'}
                className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/30 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!textInput.trim() || status !== 'Connected' || pierreState === 'thinking'}
                className="bg-white text-black px-4 py-3 rounded-lg font-bold hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      </div>

      {errorMessage && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-red-600 text-white p-5 rounded-xl text-xs z-50 animate-fade-in shadow-2xl font-bold uppercase tracking-widest">
          <AlertCircle size={20} />
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">DISMISS</button>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
          background: #050505;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-fade-in { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  );
}
