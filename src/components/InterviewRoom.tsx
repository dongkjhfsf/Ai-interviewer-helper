import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Square, Loader2, MessageSquare, ShieldAlert } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

export default function InterviewRoom({ data, onEnd }: { data: any, onEnd: (transcript: string) => void }) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [micVolume, setMicVolume] = useState(0);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Audio playback queue
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  const questions = data?.questions || [];
  const questionsContext = questions.map((q: any, i: number) => `${i+1}. [${q.difficulty}] ${q.content}`).join('\n');

  useEffect(() => {
    startSession();
    return () => {
      stopSession();
    };
  }, []);

  const startSession = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // 1. Initialize Audio Context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000, // Required by Gemini Live
      });
      await audioContextRef.current.resume();

      // 2. Get Microphone Access
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      // 3. Setup Gemini Live API
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const systemInstruction = `
        你是一个专业、严格的技术面试官，正在进行一场模拟面试。
        你必须严格、专业，仔细评估用户的回答。
        如果他们回答错了，直接指出错误。如果回答正确，予以肯定并深入追问。
        
        请务必使用中文（普通话）进行对话。
        
        以下是你必须在本次面试中按顺序提问的问题列表（从易到难）：
        ${questionsContext}
        
        面试开始时，请简短地自我介绍，并直接提出第一个问题。
        每次只问一个问题，等待用户回答后再继续。
      `;

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }, // Professional voice
          },
          systemInstruction: systemInstruction,
          // Use empty objects to enable transcription with default settings
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            setIsRecording(true);
            
            // Trigger AI to start speaking
            // Since clientContent might not be supported in this specific SDK version's LiveSendRealtimeInputParameters,
            // we will rely on the system instructions and the user's first audio input.
            // Alternatively, we can prompt the user to speak first.
            
            // Start sending audio
            processorRef.current!.onaudioprocess = (e) => {
              if (!isRecording) return;
              const inputData = e.inputBuffer.getChannelData(0);
              // Convert Float32 to Int16 PCM
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
              }
              
              // Convert to Base64
              const buffer = new ArrayBuffer(pcmData.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcmData.length; i++) {
                view.setInt16(i * 2, pcmData[i], true); // little-endian
              }
              
              const base64Data = btoa(
                new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
              );

              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: {
                    mimeType: 'audio/pcm;rate=24000',
                    data: base64Data
                  }
                });
              });
            };
            
            source.connect(processorRef.current!);
            processorRef.current!.connect(audioContextRef.current!.destination);
          },
          onmessage: (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              playAudioChunk(base64Audio);
            }

            // Handle Interruption (User spoke over AI)
            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              nextPlayTimeRef.current = audioContextRef.current?.currentTime || 0;
            }

            // Handle Transcriptions
            // AI Output Transcription
            if (message.serverContent?.modelTurn?.parts[0]?.text) {
               setTranscript(prev => [...prev, { role: 'ai', text: message.serverContent!.modelTurn!.parts[0].text! }]);
            }
          },
          onclose: () => {
            setIsConnected(false);
            setIsRecording(false);
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection lost or error occurred.");
            setIsConnected(false);
          }
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      console.error("Failed to start session:", err);
      setError(err.message || "Failed to access microphone or connect to AI.");
      setIsConnecting(false);
    }
  };

  const playAudioChunk = (base64: string) => {
    if (!audioContextRef.current) return;
    
    // Decode base64 to Int16Array
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    
    // Convert Int16 to Float32
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }

    audioQueueRef.current.push(float32Array);
    scheduleNextAudio();
  };

  const scheduleNextAudio = () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) return;
    
    const ctx = audioContextRef.current;
    
    while (audioQueueRef.current.length > 0) {
      // If we are falling behind, reset the play time
      if (nextPlayTimeRef.current < ctx.currentTime) {
        nextPlayTimeRef.current = ctx.currentTime + 0.05;
      }

      const chunk = audioQueueRef.current.shift()!;
      const audioBuffer = ctx.createBuffer(1, chunk.length, 24000);
      audioBuffer.getChannelData(0).set(chunk);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(nextPlayTimeRef.current);

      nextPlayTimeRef.current += audioBuffer.duration;
    }
  };

  const stopSession = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (sessionRef.current) {
      // sessionRef.current.close(); // Close method might vary, usually handled by server disconnect
    }
    setIsConnected(false);
    setIsRecording(false);
  };

  const handleEndInterview = () => {
    stopSession();
    // Format transcript for review
    const formattedTranscript = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n');
    onEnd(formattedTranscript);
  };

  const toggleMute = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="font-mono text-sm text-zinc-400 uppercase tracking-widest">
            {isConnecting ? 'Connecting...' : isConnected ? 'Live Session Active' : 'Disconnected'}
          </span>
        </div>
        <button 
          onClick={handleEndInterview}
          className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Square className="w-4 h-4" />
          End Interview
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* Left: Atmospheric Visualizer */}
        <div className="w-full md:w-1/2 relative flex items-center justify-center border-r border-white/10 p-12">
          {/* Ethereal background glows */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div 
              animate={{ 
                scale: isRecording ? [1, 1.2, 1] : 1,
                opacity: isRecording ? [0.3, 0.6, 0.3] : 0.1
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-500/20 rounded-full blur-[100px]"
            />
          </div>

          <div className="z-10 text-center">
            <motion.div 
              animate={{ 
                scale: isRecording ? [1, 1.05 + (micVolume / 255) * 0.2, 1] : 1,
                boxShadow: isRecording ? `0 0 ${50 + (micVolume / 255) * 100}px rgba(249,115,22,${0.3 + (micVolume / 255) * 0.5})` : 'none'
              }}
              transition={{ duration: 0.1, ease: "linear" }}
              className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center backdrop-blur-xl border ${
                isRecording ? 'bg-white/10 border-orange-500/50' : 'bg-white/5 border-white/10'
              }`}
            >
              {isConnecting ? (
                <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
              ) : (
                <Mic className={`w-8 h-8 ${isRecording ? 'text-orange-400' : 'text-zinc-500'}`} />
              )}
            </motion.div>
            
            <h2 className="mt-8 text-3xl font-light tracking-tight">
              {isConnecting ? 'Establishing Link...' : '请说“你好”开始面试'}
            </h2>
            <p className="mt-2 text-zinc-500 font-mono text-sm">
              Speak clearly. The AI will respond automatically.
            </p>

            {error && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-left max-w-sm mx-auto">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <div className="mt-12 flex justify-center gap-4">
              <button 
                onClick={toggleMute}
                disabled={!isConnected}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  isRecording 
                    ? 'bg-white/10 hover:bg-white/20 text-white' 
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {isRecording ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Transcript */}
        <div className="w-full md:w-1/2 bg-zinc-900/50 p-8 flex flex-col">
          <div className="flex items-center gap-2 mb-6 text-zinc-400 font-mono text-xs uppercase tracking-widest">
            <MessageSquare className="w-4 h-4" />
            Live Transcript
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
            {transcript.length === 0 && (
              <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-sm italic">
                Awaiting conversation...
              </div>
            )}
            
            {transcript.map((msg, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <span className={`text-[10px] uppercase tracking-widest mb-1 ${msg.role === 'user' ? 'text-orange-400' : 'text-blue-400'}`}>
                  {msg.role === 'user' ? 'You' : 'Interviewer'}
                </span>
                <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-orange-500/10 border border-orange-500/20 text-orange-50 rounded-tr-sm' 
                    : 'bg-white/5 border border-white/10 text-zinc-300 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
