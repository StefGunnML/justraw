'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Loader2, Coffee, AlertCircle, MessageSquare, MicOff } from 'lucide-react';
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
  
  const wsRef = useRef<VoiceWebSocket | null>(null);
  const vadRef = useRef<any>(null);
  const [vadInstance, setVadInstance] = useState<any>(null);

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
      if (data.type === 'response') {
        setHistory(prev => [...prev, { role: 'Pierre', text: data.text }]);
        setRespectScore(data.respectScore || 50);
        setPierreState('speaking');
        
        // Handle audio if provided (optional feature)
        if (data.audio) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
          audio.onended = () => setPierreState('idle');
          audio.play().catch(console.error);
        } else {
          // Fallback if no audio
          setTimeout(() => setPierreState('idle'), 3000);
        }
      }
      if (data.type === 'error') {
        setErrorMessage(data.message);
        setPierreState('annoyed');
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

  const toggleVAD = async () => {
    if (isVADEnabled) {
      if (vadInstance) vadInstance.pause();
      setIsVADEnabled(false);
      setPierreState('idle');
    } else {
      if (!vadInstance && vadRef.current) {
        try {
          const myVad = await vadRef.current.MicVAD.new({
            onSpeechStart: () => {
              console.log('Speech started');
              setPierreState('listening');
            },
            onSpeechEnd: (audio: Float32Array) => {
              console.log('Speech ended');
              setPierreState('thinking');
              if (wsRef.current) wsRef.current.sendAudio(audio);
            },
          });
          myVad.start();
          setVadInstance(myVad);
        } catch (err) {
          console.error('VAD init error:', err);
          setErrorMessage('Could not start microphone access.');
          return;
        }
      } else if (vadInstance) {
        vadInstance.start();
      }
      setIsVADEnabled(true);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-[#0a0a0a] text-[#e0e0e0] font-serif selection:bg-red-900">
      {/* Visual Background Effects */}
      <div className="fixed inset-0 pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')]"></div>
        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-red-950/20 blur-[120px] rounded-full transition-all duration-1000 ${pierreState === 'listening' ? 'scale-110 opacity-40' : 'scale-100 opacity-20'}`}></div>
      </div>

      {/* Header / Dossier Info */}
      <div className="w-full max-w-4xl flex justify-between items-center z-10 border-b border-zinc-800 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic text-zinc-100">Café JustRaw</h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 font-bold mt-1">Paris • Service Direct</p>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Humeur de Pierre</p>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${respectScore > 60 ? 'bg-emerald-500' : 'bg-red-600'}`}
                  style={{ width: `${respectScore}%` }}
                ></div>
              </div>
              <span className="text-xs font-mono text-zinc-400">{respectScore}%</span>
            </div>
          </div>
          
          <button 
            onClick={toggleVAD}
            disabled={!vadLoaded}
            className={`p-4 rounded-full border transition-all active:scale-95 ${
              isVADEnabled 
                ? 'bg-red-950/30 border-red-900 text-red-500 shadow-[0_0_20px_rgba(153,27,27,0.2)]' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            } ${!vadLoaded && 'opacity-50 cursor-not-allowed'}`}
          >
            {isVADEnabled ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-4xl flex flex-col md:flex-row gap-12 z-10">
        
        {/* Interaction Area */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 min-h-[400px]">
          <div className="relative">
            <div className={`w-48 h-48 rounded-full border-2 transition-all duration-500 flex items-center justify-center ${
              pierreState === 'listening' ? 'border-red-500 scale-105 shadow-[0_0_40px_rgba(239,68,68,0.2)]' :
              pierreState === 'speaking' ? 'border-emerald-500 animate-pulse' :
              pierreState === 'annoyed' ? 'border-orange-600 animate-shake' : 'border-zinc-800'
            }`}>
              <Coffee size={80} className={`transition-all duration-500 ${
                pierreState === 'listening' ? 'text-red-500' :
                pierreState === 'speaking' ? 'text-emerald-500' :
                pierreState === 'annoyed' ? 'text-orange-600' : 'text-zinc-700'
              }`} />
            </div>
            
            {pierreState === 'thinking' && (
              <div className="absolute -top-4 -right-4 bg-zinc-900 border border-zinc-800 p-3 rounded-2xl shadow-2xl">
                <Loader2 className="animate-spin text-zinc-400" size={24} />
              </div>
            )}
          </div>

          <div className="text-center">
            <h2 className="text-xl font-bold text-zinc-200 uppercase tracking-widest">
              {pierreState === 'listening' ? 'Pierre vous écoute...' :
               pierreState === 'thinking' ? 'Pierre réfléchit...' :
               pierreState === 'speaking' ? 'Pierre répond.' :
               pierreState === 'annoyed' ? 'Pierre est agacé.' : 'Prêt à servir.'}
            </h2>
            <p className="text-sm text-zinc-500 italic mt-2">
              {status === 'Connected' ? 'Connexion établie' : 'Recherche de Pierre...'}
            </p>
          </div>
        </div>

        {/* Chat / Transcript Area */}
        <div className="w-full md:w-[450px] bg-zinc-950/80 border border-zinc-900 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
          <div className="p-4 border-b border-zinc-900 bg-zinc-900/20 flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Dialogue</span>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-zinc-800"></div>
              <div className="w-2 h-2 rounded-full bg-zinc-800"></div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            {history.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-8">
                <MessageSquare size={40} className="mb-4" />
                <p className="text-sm italic">"Dépêchez-vous, j'ai d'autres clients."</p>
              </div>
            )}
            
            {history.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'You' ? 'items-end' : 'items-start'} animate-fade-in`}>
                <span className="text-[8px] uppercase tracking-widest text-zinc-600 font-bold mb-1">
                  {msg.role === 'You' ? 'CLIENT' : 'PIERRE'}
                </span>
                <div className={`max-w-[90%] px-4 py-3 rounded-2xl ${
                  msg.role === 'You' 
                    ? 'bg-zinc-900 text-zinc-300 rounded-tr-none' 
                    : 'bg-zinc-100 text-black font-medium rounded-tl-none shadow-[0_4px_12px_rgba(255,255,255,0.05)]'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-red-950/90 border border-red-900 p-4 rounded-2xl text-red-400 text-sm z-50 animate-bounce backdrop-blur-md">
          <AlertCircle size={18} />
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="ml-4 text-zinc-500 hover:text-white">&times;</button>
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  );
}
