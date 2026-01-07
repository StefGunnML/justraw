'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Volume2, History } from 'lucide-react';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [history, setHistory] = useState<{role: string, text: string}[]>([]);
  const [respectScore, setRespectScore] = useState(50);
  const [isPierreThinking, setIsPierreThinking] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const fillerAudios = ['/audio/sigh.mp3', '/audio/bof.mp3', '/audio/spoon.mp3'];

  useEffect(() => {
    // Steve Jobs: Ambient Paris soundscape
    ambientAudioRef.current = new Audio('https://www.soundjay.com/ambient/restaurant-ambience-01.mp3');
    ambientAudioRef.current.loop = true;
    ambientAudioRef.current.volume = 0.1;
  }, []);

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
      
      // Play ambience if not already playing
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
      setStatus('Processing...');
    }
  };

  const sendAudio = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
    const formData = new FormData();
    formData.append('file', audioBlob, 'input.mp3');

    try {
      setStatus('Pierre is judging...');
      setIsPierreThinking(true);
      
      const response = await fetch('/api/conversation', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      // Play a random filler audio to mask latency
      const randomFiller = fillerAudios[Math.floor(Math.random() * fillerAudios.length)];
      const filler = new Audio(randomFiller);
      filler.volume = 0.3;
      try {
        await filler.play();
      } catch (e) {
        console.log("Filler audio not found, skipping...");
      }

      setHistory(prev => [
        ...prev, 
        { role: 'You', text: data.userText },
        { role: 'Pierre', text: data.aiText }
      ]);

      if (data.respectScore) setRespectScore(data.respectScore);

      const audio = new Audio(data.audio);
      // Wait a tiny bit for the filler to breathe
      setTimeout(() => {
        audio.play();
        setIsPierreThinking(false);
        setStatus('Idle');
      }, 800);

    } catch (error) {
      console.error(error);
      setStatus('Error');
      setIsPierreThinking(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-black text-white selection:bg-red-500">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white">JustRaw</h1>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Respect Score</span>
            <span className={`text-xl font-mono font-bold ${respectScore < 40 ? 'text-red-500' : 'text-emerald-500'}`}>
              {respectScore}%
            </span>
          </div>
          <button 
            onClick={toggleAmbience}
            className="p-2 rounded-full border border-zinc-800 hover:bg-zinc-900 transition-colors"
          >
            <Volume2 size={20} className="text-zinc-400" />
          </button>
        </div>
      </div>
      
      {/* Chat History */}
      <div className="flex-1 w-full max-w-2xl overflow-y-auto mb-8 space-y-6 scrollbar-hide">
        {history.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center">
              <History size={32} />
            </div>
            <p className="text-sm font-medium tracking-tight">Pierre is waiting. Order something in French.</p>
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'You' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${
              msg.role === 'You' 
                ? 'bg-zinc-900 text-white rounded-tr-none' 
                : 'bg-white text-black rounded-tl-none font-medium'
            }`}>
              <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1 font-bold">
                {msg.role === 'You' ? 'L’élève' : 'Pierre'}
              </p>
              <p className="text-lg leading-snug">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="w-full max-w-2xl flex flex-col items-center gap-6">
        <div className="h-4">
          {status === 'Processing...' && <Loader2 className="animate-spin text-zinc-500" />}
          {status === 'Listening...' && <div className="flex gap-1">
            {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" style={{animationDelay: `${i*0.2}s`}} />)}
          </div>}
        </div>

        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={`group relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
            isRecording 
              ? 'bg-red-600 scale-110 shadow-[0_0_50px_rgba(220,38,38,0.4)]' 
              : 'bg-white hover:bg-zinc-200'
          }`}
        >
          {isRecording ? (
            <Square className="text-white fill-current" size={32} />
          ) : (
            <Mic className="text-black group-hover:scale-110 transition-transform" size={32} />
          )}
          
          {/* Visual Ring */}
          {!isRecording && (
            <div className="absolute -inset-2 rounded-full border border-zinc-800 opacity-50 group-hover:scale-110 transition-all duration-500" />
          )}
        </button>
        
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">
          {isRecording ? 'Relâchez pour envoyer' : 'Maintenez pour parler'}
        </p>
      </div>
    </main>
  );
}
