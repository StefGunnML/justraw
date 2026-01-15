'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Loader2, Coffee, AlertCircle, MessageSquare, MicOff, Shield, User, Globe } from 'lucide-react';
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
  const [isVADEnabled, setIsVADEnabled] = useState(false);
  const [pierreState, setPierreState] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'annoyed'>('idle');
  const [vadLoaded, setVadLoaded] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState<string>('');
  const [currentScenario, setCurrentScenario] = useState<any>(null);
  
  const wsRef = useRef<VoiceWebSocket | null>(null);
  const vadRef = useRef<any>(null);
  const [vadInstance, setVadInstance] = useState<any>(null);
  const [isInitializingVAD, setIsInitializingVAD] = useState(false);

  // Load VAD library only on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@ricky0123/vad-web').then((mod) => {
        vadRef.current = mod;
        setVadLoaded(true);
      }).catch(err => {
        console.error('Failed to load VAD:', err);
        setErrorMessage('Voice detection failed to load.');
      });
    }
  }, []);

  // Initialize WebSocket
  useEffect(() => {
    const onMessage = (data: any) => {
      console.log('[WS] Received message:', data.type);
      if (data.type === 'ready') {
        setCurrentScenario(data.scenario);
        setRespectScore(data.respectScore);
        if (data.imageUrl) setBackgroundUrl(data.imageUrl);
        setStatus('Connected');
      }

      if (data.type === 'response') {
        setHistory(prev => [...prev, { role: data.character || 'AI', text: data.text }]);
        setRespectScore(data.respectScore || 50);
        setPierreState('speaking');
        
        if (data.imageUrl) {
          setBackgroundUrl(data.imageUrl);
        }

        if (data.audio) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
          audio.onended = () => setPierreState('idle');
          audio.play().catch(console.error);
        } else {
          setTimeout(() => setPierreState('idle'), 3000);
        }
      }
      if (data.type === 'error') {
        setErrorMessage(data.message);
        setPierreState('annoyed');
      }
    };

    const onStatus = (newStatus: string) => {
      console.log('[WS] Status changed:', newStatus);
      setStatus(newStatus);
      if (newStatus === 'Connected') setPierreState('idle');
    };

    wsRef.current = new VoiceWebSocket(onMessage, onStatus);
    wsRef.current.connect();

    return () => {
      wsRef.current?.disconnect();
    };
  }, []);

  const toggleVAD = async () => {
    if (isInitializingVAD) return;

    if (isVADEnabled) {
      if (vadInstance) {
        console.log('[VAD] Pausing...');
        vadInstance.pause();
      }
      setIsVADEnabled(false);
      setPierreState('idle');
    } else {
      if (!vadInstance && vadRef.current) {
        setIsInitializingVAD(true);
        try {
          console.log('[VAD] Starting initialization...');
          const myVad = await vadRef.current.MicVAD.new({
            onSpeechStart: () => {
              console.log('[VAD] Speech started');
              setPierreState('listening');
            },
            onSpeechEnd: (audio: Float32Array) => {
              console.log('[VAD] Speech ended, sending audio...');
              setPierreState('thinking');
              if (wsRef.current) wsRef.current.sendAudio(audio);
            },
          });
          myVad.start();
          setVadInstance(myVad);
          setIsVADEnabled(true);
        } catch (err) {
          console.error('[VAD] Init error:', err);
          setErrorMessage('Could not start microphone access.');
        } finally {
          setIsInitializingVAD(false);
        }
      } else if (vadInstance) {
        console.log('[VAD] Resuming...');
        vadInstance.start();
        setIsVADEnabled(true);
      }
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-[#050505] text-[#e0e0e0] font-sans selection:bg-red-900 transition-all duration-1000 overflow-hidden">
      
      {/* REACTIVE BACKGROUND (FLUX Generated) */}
      <div className="fixed inset-0 pointer-events-none transition-all duration-1000 ease-in-out">
        {backgroundUrl ? (
          <img 
            src={backgroundUrl} 
            className="w-full h-full object-cover opacity-30 blur-[2px] scale-105"
            alt="Background"
          />
        ) : (
          <div className="w-full h-full bg-zinc-900 opacity-20"></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90"></div>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-red-950/10 blur-[150px] rounded-full transition-all duration-1000 ${pierreState === 'listening' ? 'scale-125 opacity-40' : 'scale-100 opacity-20'}`}></div>
      </div>

      {/* Header / Dossier Info */}
      <div className="w-full max-w-6xl flex justify-between items-center z-20 border-b border-white/5 pb-8 mb-12 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="bg-white text-black px-3 py-1 font-black text-2xl tracking-tighter">RAW</div>
          <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.3em] uppercase text-zinc-400">Social Friction Engine</h1>
            <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mt-1">
              {currentScenario?.location || 'System Initializing...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="hidden md:block">
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black mb-2 flex items-center gap-2">
              <Shield size={10} /> Reputation Status
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
          
          <button 
            onClick={toggleVAD}
            disabled={!vadLoaded}
            className={`group relative p-5 rounded-xl border transition-all active:scale-95 ${
              isVADEnabled 
                ? 'bg-red-600 border-red-500 text-white shadow-[0_0_30px_rgba(220,38,38,0.4)]' 
                : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20'
            } ${!vadLoaded && 'opacity-30 cursor-not-allowed'}`}
          >
            {isVADEnabled ? <Mic size={28} /> : <MicOff size={28} />}
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-widest font-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {isVADEnabled ? 'Mic Active' : 'Mic Off'}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-6xl flex flex-col md:flex-row gap-16 z-20">
        
        {/* Interaction Area */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-12">
          <div className="relative">
            {/* The Avatar Frame */}
            <div className={`w-64 h-64 rounded-2xl border transition-all duration-700 flex items-center justify-center overflow-hidden bg-black/40 backdrop-blur-xl ${
              pierreState === 'listening' ? 'border-red-500/50 scale-105 shadow-[0_0_60px_rgba(239,68,68,0.15)]' :
              pierreState === 'speaking' ? 'border-emerald-500/50 shadow-[0_0_60px_rgba(16,185,129,0.15)]' :
              pierreState === 'annoyed' ? 'border-orange-600 animate-shake' : 'border-white/5'
            }`}>
              {backgroundUrl ? (
                <img src={backgroundUrl} className={`w-full h-full object-cover transition-all duration-1000 ${pierreState === 'thinking' ? 'grayscale opacity-50' : 'opacity-80'}`} />
              ) : (
                <Coffee size={100} className="text-zinc-800" />
              )}
            </div>
            
            {pierreState === 'thinking' && (
              <div className="absolute -top-6 -right-6 bg-white text-black p-4 rounded-xl shadow-2xl animate-bounce">
                <Loader2 className="animate-spin" size={24} />
              </div>
            )}
          </div>

          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
              {pierreState === 'listening' ? 'System Listening...' :
               pierreState === 'thinking' ? 'Processing...' :
               pierreState === 'speaking' ? `${currentScenario?.character || 'Character'} Speaking` :
               pierreState === 'annoyed' ? 'Friction Detected' : 'Ready'}
            </h2>
            <div className="flex justify-center gap-4 text-[10px] uppercase tracking-widest font-bold text-zinc-500">
              <span className="flex items-center gap-1"><Globe size={12} /> {currentScenario?.location || 'Paris'}</span>
              <span className="flex items-center gap-1"><User size={12} /> {currentScenario?.character || 'Pierre'}</span>
            </div>
          </div>
        </div>

        {/* Chat / Transcript Area */}
        <div className="w-full md:w-[480px] flex flex-col bg-zinc-950/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-zinc-400">Scenario Log</span>
            <div className="px-2 py-0.5 rounded bg-red-600/10 text-red-500 text-[8px] font-black uppercase tracking-widest">Live Feed</div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide max-h-[500px]">
            {history.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-8 py-20">
                <MessageSquare size={48} className="mb-6" />
                <p className="text-sm italic font-serif">"Begin your conduct. The record is active."</p>
              </div>
            )}
            
            {history.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'You' ? 'items-end' : 'items-start'} animate-fade-in`}>
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-black mb-2">
                  {msg.role === 'You' ? 'SUBJECT' : (currentScenario?.character?.toUpperCase() || 'AI')}
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
