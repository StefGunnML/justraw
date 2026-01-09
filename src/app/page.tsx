'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Volume2, History, Coffee, AlertCircle, Clock, MessageSquare } from 'lucide-react';

type ConversationMessage = {
  role: string;
  text: string;
};

type PastSession = {
  session_id: string;
  user_message: string;
  ai_response: string;
  respect_score_after: number;
  created_at: string;
  message_count: number;
};

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [respectScore, setRespectScore] = useState(50);
  const [isMadame, setIsMadame] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [showHistory, setShowHistory] = useState(false);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    // Pierre's Ambient soundscape - Disabled if URL is dead
    const audio = new Audio('https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg');
    audio.loop = true;
    audio.volume = 0.25;
    ambientAudioRef.current = audio;

    // Load current session history on mount
    loadSessionHistory();

    return () => {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        ambientAudioRef.current = null;
      }
    };
  }, []);

  const loadSessionHistory = async () => {
    try {
      const response = await fetch(`/api/conversation?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.conversations && data.conversations.length > 0) {
          const loadedHistory = data.conversations.flatMap((conv: any) => [
            { role: 'You', text: conv.user_message },
            { role: 'Pierre', text: conv.ai_response }
          ]);
          setHistory(loadedHistory);
          // Set the respect score from the last message
          const lastConv = data.conversations[data.conversations.length - 1];
          setRespectScore(lastConv.respect_score_after);
        }
      }
    } catch (err) {
      console.error('Failed to load session history:', err);
    }
  };

  const loadPastSessions = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/conversation');
      if (response.ok) {
        const data = await response.json();
        setPastSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load past sessions:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadSession = async (sessionIdToLoad: string) => {
    try {
      const response = await fetch(`/api/conversation?sessionId=${sessionIdToLoad}`);
      if (response.ok) {
        const data = await response.json();
        if (data.conversations && data.conversations.length > 0) {
          const loadedHistory = data.conversations.flatMap((conv: any) => [
            { role: 'You', text: conv.user_message },
            { role: 'Pierre', text: conv.ai_response }
          ]);
          setHistory(loadedHistory);
          const lastConv = data.conversations[data.conversations.length - 1];
          setRespectScore(lastConv.respect_score_after);
          setShowHistory(false);
        }
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  useEffect(() => {
    if (respectScore > 80) setIsMadame(true);
  }, [respectScore]);

  const toggleAmbience = () => {
    if (!ambientAudioRef.current) return;
    if (ambientAudioRef.current.paused) {
      ambientAudioRef.current.play().catch(err => {
        console.warn("Ambient audio failed to play:", err);
      });
    } else {
      ambientAudioRef.current.pause();
    }
  };

  const startRecording = async () => {
    // Prevent multiple recordings
    if (isRecording || isProcessingRef.current) return;
    
    setErrorMessage(null);
    try {
      console.log('[Recording] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('[Recording] Microphone access granted');
      
      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';

      console.log(`[Recording] Using MIME type: ${mimeType}`);
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log(`[Recording] Data available: ${event.data.size} bytes`);
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = sendAudio;
      mediaRecorder.start();
      setIsRecording(true);
      setStatus('Listening...');
      console.log('[Recording] Started recording');
      
      if (ambientAudioRef.current?.paused) {
        ambientAudioRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error("[Recording] Microphone error:", err);
      setErrorMessage(`Microphone error: ${err.message || 'Please allow microphone access in browser settings'}`);
      setStatus('Idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus('Thinking...');
      
      // Stop all tracks to release the microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const sendAudio = async () => {
    // Prevent duplicate submissions
    if (isProcessingRef.current || audioChunksRef.current.length === 0) {
      setStatus('Idle');
      return;
    }

    isProcessingRef.current = true;
    const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
    
    // Clear chunks immediately to prevent duplicates
    audioChunksRef.current = [];
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'input.webm');
    formData.append('sessionId', sessionId);

    try {
      const response = await fetch('/api/conversation', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || errData.error || 'Server error');
      }

      const data = await response.json();

      setHistory(prev => [
        ...prev, 
        { role: 'You', text: data.userText || "..." },
        { role: 'Pierre', text: data.aiText || "..." }
      ]);

      if (data.respectScore !== undefined) setRespectScore(data.respectScore);

      if (data.audio) {
        try {
          const audio = new Audio(data.audio);
          audio.oncanplaythrough = () => {
            audio.play().catch(e => console.warn("Audio play blocked:", e));
          };
          audio.onerror = (e) => {
            console.warn("Pierre's voice source is invalid or unreachable", e);
          };
        } catch (playErr) {
          console.warn("Pierre's voice setup failed:", playErr);
        }
      }
      
      setStatus('Idle');
      isProcessingRef.current = false;

    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message);
      setStatus('Idle');
      isProcessingRef.current = false;
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
            title="Toggle Paris Ambience"
          >
            <Volume2 size={18} className="text-zinc-400" />
          </button>
          <button 
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) loadPastSessions();
            }}
            className="p-3 rounded-full border border-zinc-800 hover:bg-zinc-900 transition-all active:scale-95"
            title="View Conversation History"
          >
            <History size={18} className="text-zinc-400" />
          </button>
        </div>
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl h-[80vh] bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black tracking-wide uppercase">Conversation History</h2>
                <p className="text-xs text-zinc-500 mt-1">Past sessions with Pierre</p>
              </div>
              <button 
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-zinc-900 rounded-lg transition-all"
              >
                <span className="text-zinc-400 text-2xl">&times;</span>
              </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin text-zinc-500" size={32} />
                </div>
              ) : pastSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                  <MessageSquare size={48} className="mb-4 opacity-50" />
                  <p className="text-sm">No past conversations yet</p>
                </div>
              ) : (
                pastSessions.map((session) => (
                  <div 
                    key={session.session_id}
                    onClick={() => loadSession(session.session_id)}
                    className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:bg-zinc-900 hover:border-zinc-700 cursor-pointer transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-zinc-500" />
                        <span className="text-xs text-zinc-500">
                          {new Date(session.created_at).toLocaleString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-600">
                          {session.message_count} {session.message_count === 1 ? 'message' : 'messages'}
                        </span>
                        <span className={`text-xs font-bold ${session.respect_score_after < 40 ? 'text-red-500' : 'text-emerald-500'}`}>
                          {session.respect_score_after}%
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-400 truncate mb-1">
                      <span className="text-zinc-600">You:</span> {session.user_message}
                    </p>
                    <p className="text-sm text-zinc-300 truncate">
                      <span className="text-zinc-600">Pierre:</span> {session.ai_response}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Conversation Area */}
      <div className="flex-1 w-full max-w-2xl overflow-y-auto mb-8 space-y-8 scrollbar-hide p-4">
        {history.length === 0 && !errorMessage && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-800 space-y-6 mt-20">
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

        {errorMessage && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-sm animate-fade-in">
            <AlertCircle size={18} />
            <p>{errorMessage}</p>
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
        <div id="anchor" className="h-1" />
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
            <div className="flex items-center gap-1 h-4">
              {[1,2,3,4,5].map(i => (
                <div 
                  key={i} 
                  className="w-1 bg-red-500 rounded-full animate-vibrate" 
                  style={{animationDelay: `${i*0.1}s`, height: `${Math.random()*100 + 20}%`}} 
                />
              ))}
            </div>
          )}
        </div>

        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={isRecording ? stopRecording : undefined}
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
