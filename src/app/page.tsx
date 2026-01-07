'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Volume2, History, Coffee } from 'lucide-react';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [history, setHistory] = useState<{role: string, text: string}[]>([]);
  const [respectScore, setRespectScore] = useState(50);
  const [isMadame, setIsMadame] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Steve Jobs: Ambient Paris soundscape (Start on first interaction)
    ambientAudioRef.current = new Audio('https://www.soundjay.com/ambient/restaurant-ambience-01.mp3');
    ambientAudioRef.current.loop = true;
    ambientAudioRef.current.volume = 0.05;
  }, []);

  useEffect(() => {
    if (respectScore > 80) setIsMadame(true);
  }, [respectScore]);

  const toggleAmbience = () => {
    if (ambientAudioRef.current?.paused) {
      ambientAudioRef.current.play();
    } else {
      ambientAudioRef.current?.pause();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = sendAudio;
      mediaRecorder.start();
      setIsRecording(true);
      setStatus('Listening...');
      
      if (ambientAudioRef.current?.paused) ambientAudioRef.current.play();
    } catch (err) {
      console.error("Microphone error:", err);
      setStatus('Microphone Error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus('Thinking...');
    }
  };

  const sendAudio = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
    const formData = new FormData();
    formData.append('file', audioBlob, 'input.mp3');

    try {
      const response = await fetch('/api/conversation', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setHistory(prev => [
        ...prev, 
        { role: 'You', text: data.userText },
        { role: 'Pierre', text: data.aiText }
      ]);

      if (data.respectScore) setRespectScore(data.respectScore);

      const audio = new Audio(data.audio);
      audio.play();
      setStatus('Idle');

    } catch (error) {
      console.error(error);
      setStatus('Error');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-black text-white selection:bg-red-500 font-sans">
      {/* Header / HUD */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-8 border-b border-zinc-900 pb-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-[0.2em] uppercase italic text-white">JustRaw</h1>
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Paris, FR • 18ème</p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Status</span>
            <span className={`text-sm font-bold tracking-tighter ${isMadame ? 'text-emerald-400' : 'text-zinc-400 uppercase italic'}`}>
              {isMadame ? 'Madame' : 'L’élève'}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Respect</span>
            <span className={`text-xl font-mono font-bold ${respectScore < 40 ? 'text-red-500' : 'text-emerald-500'}`}>
              {respectScore}%
            </span>
          </div>
          <button 
            onClick={toggleAmbience}
            className="p-3 rounded-full border border-zinc-800 hover:bg-zinc-900 transition-all active:scale-95"
          >
            <Volume2 size={18} className="text-zinc-400" />
          </button>
        </div>
      </div>
      
      {/* Conversation Area */}
      <div className="flex-1 w-full max-w-2xl overflow-y-auto mb-8 space-y-8 scrollbar-hide">
        {history.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-800 space-y-6">
            <div className="w-24 h-24 rounded-full border border-zinc-900 flex items-center justify-center relative">
              <Coffee size={40} className="text-zinc-900" />
              <div className="absolute inset-0 rounded-full border-t border-zinc-700 animate-spin-slow" />
            </div>
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-700 mb-2">Simulation Ready</p>
              <p className="text-zinc-500 italic font-medium">"Bonjour, qu'est-ce que vous voulez ?"</p>
            </div>
          </div>
        )}
        
        {history.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'You' ? 'items-end' : 'items-start'} group animate-fade-in`}>
            <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-bold mb-2 ml-1">
              {msg.role === 'You' ? 'Vous' : 'Pierre'}
            </span>
            <div className={`max-w-[90%] px-5 py-4 rounded-xl transition-all duration-500 ${
              msg.role === 'You' 
                ? 'bg-zinc-950 border border-zinc-900 text-zinc-300' 
                : 'bg-white text-black font-medium shadow-[0_10px_40px_rgba(255,255,255,0.05)]'
            }`}>
              <p className="text-lg leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controller */}
      <div className="w-full max-w-2xl bg-zinc-950/50 backdrop-blur-xl border border-zinc-900 rounded-3xl p-8 flex flex-col items-center gap-6">
        <div className="h-6">
          {status === 'Thinking...' && (
            <div className="flex items-center gap-2 text-zinc-500">
              <Loader2 className="animate-spin" size={16} />
              <span className="text-[10px] uppercase tracking-widest font-black">Pierre réfléchit...</span>
            </div>
          )}
          {status === 'Listening...' && (
            <div className="flex items-end gap-1 h-4">
              {[1,2,3,4,5].map(i => (
                <div 
                  key={i} 
                  className="w-1 bg-red-500 rounded-full animate-vibrate" 
                  style={{animationDelay: `${i*0.1}s`, height: `${Math.random()*100}%`}} 
                />
              ))}
            </div>
          )}
        </div>

        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={`group relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 ${
            isRecording 
              ? 'bg-red-600 scale-95 shadow-[0_0_60px_rgba(220,38,38,0.3)]' 
              : 'bg-zinc-100 hover:bg-white active:scale-95'
          }`}
        >
          {isRecording ? (
            <Square className="text-white fill-current" size={32} />
          ) : (
            <Mic className="text-black group-hover:scale-110 transition-transform" size={32} />
          )}
          
          {/* Animated Glow */}
          {!isRecording && (
            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping-slow opacity-0 group-hover:opacity-100" />
          )}
        </button>
        
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-black">
            {isRecording ? 'Relâchez pour commander' : 'Maintenez pour parler'}
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes vibrate {
          0%, 100% { height: 20%; }
          50% { height: 100%; }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        .animate-vibrate { animation: vibrate 0.5s ease-in-out infinite; }
        .animate-spin-slow { animation: spin 10s linear infinite; }
        .animate-ping-slow { animation: ping 3s cubic-bezier(0, 0, 0.2, 1) infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  );
}
