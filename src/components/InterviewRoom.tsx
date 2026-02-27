import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Square, Loader2, MessageSquare, ShieldAlert, BrainCircuit, AudioLines, Ear, Sparkles, Volume2, Settings2, CheckCheck, X, Send } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, StartSensitivity, EndSensitivity } from '@google/genai';

// AI Status types for the status bar
type AIStatus =
  | 'idle'           // 空闲
  | 'connecting'     // 正在连接
  | 'listening'      // 正在聆听
  | 'thinking'       // 正在思考
  | 'speaking'       // 正在回答
  | 'interrupted'    // 被打断
  | 'disconnected';  // 已断开

const STATUS_CONFIG: Record<AIStatus, { label: string; icon: React.ReactNode; color: string; bgColor: string; pulseColor: string }> = {
  idle: {
    label: '等待中...',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10',
    pulseColor: 'bg-zinc-400',
  },
  connecting: {
    label: '正在建立连接...',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    pulseColor: 'bg-amber-400',
  },
  listening: {
    label: '正在聆听您的回答',
    icon: <Ear className="w-4 h-4" />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    pulseColor: 'bg-green-400',
  },
  thinking: {
    label: '正在组织语言...',
    icon: <BrainCircuit className="w-4 h-4" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    pulseColor: 'bg-purple-400',
  },
  speaking: {
    label: '面试官正在讲话',
    icon: <AudioLines className="w-4 h-4" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    pulseColor: 'bg-blue-400',
  },
  interrupted: {
    label: '已被打断，正在重新聆听',
    icon: <Ear className="w-4 h-4" />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    pulseColor: 'bg-orange-400',
  },
  disconnected: {
    label: '连接已断开',
    icon: <ShieldAlert className="w-4 h-4" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    pulseColor: 'bg-red-400',
  },
};

export default function InterviewRoom({ data, onEnd }: { data: any, onEnd: (transcript: string) => void }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [micVolume, setMicVolume] = useState(0);
  const [aiStatus, setAiStatus] = useState<AIStatus>('connecting');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [micDeviceName, setMicDeviceName] = useState<string>('检测中...');
  const [showMicTest, setShowMicTest] = useState(false);
  const [micPeakVolume, setMicPeakVolume] = useState(0);
  const [micTestStatus, setMicTestStatus] = useState<'idle' | 'good' | 'low' | 'silent'>('idle');
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);
  const reconnectCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micPeakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micPeakRef = useRef(0);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use ref for mute state so callback closures always see current value
  const isMutedRef = useRef(false);

  // Audio playback queue
  const audioQueueRef = useRef<Float32Array[]>([]);
  const nextPlayTimeRef = useRef(0);
  // Track if AI is currently playing audio
  const isSpeakingRef = useRef(false);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRunIdRef = useRef(0);
  const isSessionOpenRef = useRef(false);
  // Track if AI has ever sent audio in this session — used to prevent
  // pointless reconnect loops when the model never actually responds.
  const hasReceivedAiAudioRef = useRef(false);

  // Accumulate partial transcription text
  // These accumulate across multiple messages within a single turn
  const pendingAiTextRef = useRef('');
  const pendingUserTextRef = useRef('');

  // Live/streaming preview of in-progress transcription (shown as draft bubbles)
  const [liveUserText, setLiveUserText] = useState('');
  const [liveAiText, setLiveAiText] = useState('');

  // Track the current "who is talking" state for ordering
  // 'model' = AI is currently generating a turn, 'user' = user just spoke
  const currentTurnRoleRef = useRef<'model' | 'user' | null>(null);

  const questions = data?.questions || [];
  const questionsContext = questions.map((q: any, i: number) => `${i + 1}. [${q.difficulty}] ${q.content}`).join('\n');

  // Auto scroll transcript — also triggered by live bubble updates
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, liveUserText, liveAiText]);

  // Timer
  useEffect(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Mic volume animation + peak tracking for mic test
  const updateVolume = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.fftSize);
      analyserRef.current.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const vol = Math.min(255, rms * 512);
      setMicVolume(vol);
      // Track peak for mic test
      if (vol > micPeakRef.current) micPeakRef.current = vol;
    }
    animationRef.current = requestAnimationFrame(updateVolume);
  }, []);

  // Mic test: periodically sample peak volume to give user feedback
  useEffect(() => {
    if (showMicTest) {
      micPeakRef.current = 0;
      micPeakTimerRef.current = setInterval(() => {
        const peak = micPeakRef.current;
        setMicPeakVolume(peak);
        if (peak > 30) setMicTestStatus('good');
        else if (peak > 5) setMicTestStatus('low');
        else setMicTestStatus('silent');
        micPeakRef.current = 0;
      }, 500);
    } else {
      if (micPeakTimerRef.current) {
        clearInterval(micPeakTimerRef.current);
        micPeakTimerRef.current = null;
      }
      setMicTestStatus('idle');
    }
    return () => {
      if (micPeakTimerRef.current) {
        clearInterval(micPeakTimerRef.current);
        micPeakTimerRef.current = null;
      }
    };
  }, [showMicTest]);

  useEffect(() => {
    startSession();
    return () => {
      stopSession();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Sanitize transcription output: remove glitch artifacts (repeated chars, unusual codepoints)
  const sanitizeTranscript = (text: string): string => {
    if (!text) return text;
    // Remove any character repeated 7+ times consecutively (API noise artifact)
    let result = text.replace(/(.)(\1){6,}/g, '');
    // Keep only: ASCII printable, extended Latin, common CJK punctuation,
    // Hiragana/Katakana (often mixed), CJK unified, fullwidth, newlines.
    // Strip anything else (Thai, symbols, Devanagari etc — not expected in zh/en output)
    result = result.replace(
      /[^\u0020-\u007E\u00A0-\u024F\u2013-\u2026\u3000-\u303F\u3041-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF\n]/g,
      ''
    );
    return result.trim();
  };

  // Helper: flush pending user text into transcript
  // When user text is flushed because AI model is starting to respond,
  // show 'thinking' status so users know their input was received.
  const flushPendingUserText = (triggerThinking = false) => {
    const raw = pendingUserTextRef.current.trim();
    pendingUserTextRef.current = '';
    setLiveUserText('');
    if (raw) {
      const text = sanitizeTranscript(raw);
      if (text) {
        setTranscript(prev => [...prev, { role: 'user', text }]);
        if (triggerThinking) setAiStatus('thinking');
      }
    }
  };

  // Helper: flush pending AI text into transcript
  const flushPendingAiText = (suffix?: string) => {
    const raw = pendingAiTextRef.current.trim() + (suffix || '');
    pendingAiTextRef.current = '';
    setLiveAiText('');
    if (raw.trim()) {
      const text = sanitizeTranscript(raw.trim());
      if (text) setTranscript(prev => [...prev, { role: 'ai', text }]);
    }
  };

  const cleanupSessionResources = () => {
    const currentSession = sessionRef.current;
    sessionRef.current = null;
    isSessionOpenRef.current = false;

    // Reset pending text to avoid leaking partial transcription across sessions
    pendingUserTextRef.current = '';
    pendingAiTextRef.current = '';
    currentTurnRoleRef.current = null;
    setLiveUserText('');
    setLiveAiText('');

    // Clear reconnect countdown
    if (reconnectCountdownRef.current) {
      clearInterval(reconnectCountdownRef.current);
      reconnectCountdownRef.current = null;
    }
    setReconnectCountdown(null);

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      if ('onaudioprocess' in workletNodeRef.current) {
        (workletNodeRef.current as ScriptProcessorNode).onaudioprocess = null;
      }
      workletNodeRef.current = null;
    }
    if (monitorGainRef.current) {
      monitorGainRef.current.disconnect();
      monitorGainRef.current = null;
    }
    analyserRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    if (currentSession) {
      try { currentSession.close?.(); } catch (_) { }
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
    audioQueueRef.current = [];
  };

  const scheduleReconnect = (reason: string) => {
    if (!shouldReconnectRef.current || reconnectTimerRef.current) return;

    // If the AI never sent any audio in this session, reconnecting won't
    // help (model issue / API error) — stop immediately instead of looping.
    if (!hasReceivedAiAudioRef.current) {
      setError(`无法建立稳定连接（${reason}），请检查网络或 API 配置后重新进入面试。`);
      setAiStatus('disconnected');
      return;
    }

    const attempt = reconnectAttemptsRef.current + 1;
    if (attempt > 3) {
      setError(`连接中断（${reason}），已停止自动重连，请结束后重新进入面试。`);
      return;
    }

    reconnectAttemptsRef.current = attempt;
    const delaySeconds = Math.min(5, attempt);
    const delayMs = delaySeconds * 1000;
    setAiStatus('connecting');

    // Start a real countdown
    if (reconnectCountdownRef.current) clearInterval(reconnectCountdownRef.current);
    setReconnectCountdown(delaySeconds);
    let remaining = delaySeconds;
    reconnectCountdownRef.current = setInterval(() => {
      remaining -= 1;
      setReconnectCountdown(remaining);
      if (remaining <= 0) {
        if (reconnectCountdownRef.current) clearInterval(reconnectCountdownRef.current);
        reconnectCountdownRef.current = null;
        setReconnectCountdown(null);
      }
    }, 1000);

    setError(`连接中断（${reason}），正在重连...`);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      startSession();
    }, delayMs);
  };

  // Force-end user's speech turn: signals VAD to stop waiting and trigger AI response immediately
  const handleFinishSpeaking = () => {
    if (!sessionRef.current || !isSessionOpenRef.current) return;
    try {
      sessionRef.current.sendRealtimeInput({ audioStreamEnd: true });
      // Re-enable mic stream immediately after (so AI echo cancellation keeps working)
      // The stream end only signals the end of this speech segment
      // Setting thinking gives immediate visual feedback that AI received the input
      if (pendingUserTextRef.current.trim() || liveUserText.trim()) {
        setAiStatus('thinking');
      }
    } catch (_) {}
  };

  const pcmToBase64 = (pcmData: Int16Array) => {
    const bytes = new Uint8Array(pcmData.buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  const startSession = async () => {
    const runId = ++sessionRunIdRef.current;
    try {
      shouldReconnectRef.current = true;
      cleanupSessionResources();
      setAiStatus('connecting');
      setError(null);

      // 1. Create separate AudioContexts for capture (16kHz) and playback (24kHz)
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      await audioContextRef.current.resume();

      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
      await playbackContextRef.current.resume();

      // 2. Get Microphone Access
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        }
      });

      // Detect and display active microphone device name
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const inputDevices = devices.filter(d => d.kind === 'audioinput');
          const activeDevice = inputDevices.find(d => d.deviceId === settings.deviceId);
          setMicDeviceName(activeDevice?.label || audioTrack.label || '未知设备');
        } catch {
          setMicDeviceName(audioTrack.label || '未知设备');
        }
      }

      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);

      // Setup analyser for volume visualization
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      animationRef.current = requestAnimationFrame(updateVolume);

      // Use ScriptProcessor for audio capture (wider browser support)
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      workletNodeRef.current = processor;

      // 3. Setup Gemini Live API
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        throw new Error('API Key 未配置。请在 .env 文件中设置 GEMINI_API_KEY。');
      }

      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

      const systemInstruction = `
你是一个非常严格、专业的技术面试官。你正在进行一场模拟面试。

【核心行为规则】
1. 你必须始终使用中文（普通话）进行对话。
2. 你必须非常严格地评估候选人的回答。这不是友好聊天，而是严肃的模拟面试。
3. 对于每一个回答，你必须：
   - 如果回答完全正确：简短肯定，然后立即进入下一个问题。
   - 如果回答部分正确：指出正确的部分，然后**明确指出错误或缺失的部分**，并给出正确答案的关键要点。然后进入下一个问题。
   - 如果回答完全错误或跑题：直接指出这是错误的，给出正确答案，然后进入下一个问题。
4. 每个问题讨论完毕后，你必须给出该问题的**标准答案要点**（简短的2-3句话概括关键知识点），这样候选人可以学习。

【重要的交互规则】
- 每次只问一个问题，等候选人完整回答后再继续
- 不要抢话。确保候选人说完后再回应
- 你的回应应该简洁有力，不要长篇大论
- 当候选人的回答不清晰时，可以要求他"请再说清楚一点"

【面试流程】
面试开始时，请简短地自我介绍（一句话即可），然后直接提出第一个问题。

以下是本次面试的问题列表（从易到难，按顺序提问）：
${questionsContext}

当所有问题问完后，给出一个简短的总体评价，包括优点和需要改进的地方。
      `.trim();

      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // VAD configuration: make the model wait longer before responding
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              // LOW sensitivity = less likely to detect start of speech prematurely (fewer false triggers)
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
              // LOW end sensitivity = less likely to end speech prematurely (waits longer)
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
              // Extra padding before confirming speech start (ms)
              prefixPaddingMs: 100,
              // How long to wait in silence before considering speech ended (ms)
              // 3000ms = 3 seconds of silence required before the AI will respond
              // Increased from 2000ms to better support stuttering/hesitating speakers
              silenceDurationMs: 3000,
            },
          },
        },
        callbacks: {
          onopen: () => {
            if (runId !== sessionRunIdRef.current) return;
            isSessionOpenRef.current = true;
            console.log('[LiveAPI] Connected');
            setIsConnected(true);
            setAiStatus('listening');
            setError(null);
            // Reset per-session tracking so each new connection starts fresh.
            reconnectAttemptsRef.current = 0;
            hasReceivedAiAudioRef.current = false;
          },
          onmessage: (message: LiveServerMessage) => {
            if (runId !== sessionRunIdRef.current || sessionRef.current !== session) return;
            handleServerMessage(message);
          },
          onclose: (event?: any) => {
            if (runId !== sessionRunIdRef.current || sessionRef.current !== session) return;
            // Null out immediately so onaudioprocess stops sending to the dead socket.
            isSessionOpenRef.current = false;
            sessionRef.current = null;
            console.log('[LiveAPI] Connection closed', {
              code: event?.code,
              reason: event?.reason,
              wasClean: event?.wasClean,
            });
            setIsConnected(false);
            setAiStatus('disconnected');
            scheduleReconnect('连接关闭');
          },
          onerror: (err: any) => {
            if (runId !== sessionRunIdRef.current || sessionRef.current !== session) return;
            // Null out immediately so onaudioprocess stops sending to the dead socket.
            isSessionOpenRef.current = false;
            sessionRef.current = null;
            console.error('[LiveAPI] Error:', err);
            setError(`连接错误: ${err?.message || '未知错误'}`);
            setIsConnected(false);
            setAiStatus('disconnected');
            scheduleReconnect(err?.message || '连接异常');
          }
        }
      });

      if (runId !== sessionRunIdRef.current) {
        try { session.close?.(); } catch (_) { }
        return;
      }
      sessionRef.current = session;

      // Set up audio sending via processor
      processor.onaudioprocess = (e) => {
        if (runId !== sessionRunIdRef.current || sessionRef.current !== session) return;
        if (!isSessionOpenRef.current) return;
        if (isMutedRef.current) return;
        // NOTE: Do NOT gate on isSpeakingRef — the Gemini Live API requires
        // a continuous audio stream for its server-side VAD to function.
        // Browser echoCancellation handles feedback prevention.

        const inputData = e.inputBuffer.getChannelData(0);

        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const base64Data = pcmToBase64(pcmData);

        try {
          session.sendRealtimeInput({
            audio: {
              data: base64Data,
              mimeType: 'audio/pcm;rate=16000',
            }
          });
        } catch (err) {
          const message = (err as any)?.message || '';
          if (message.includes('CLOSING or CLOSED')) {
            processor.onaudioprocess = null;
          }
          console.error('[Audio] Failed to send audio:', err);
        }
      };

      source.connect(processor);
      const silentMonitor = audioContextRef.current.createGain();
      silentMonitor.gain.value = 0;
      monitorGainRef.current = silentMonitor;
      processor.connect(silentMonitor);
      silentMonitor.connect(audioContextRef.current.destination);

      // Send initial text to trigger AI greeting
      setTimeout(() => {
        if (runId !== sessionRunIdRef.current || sessionRef.current !== session) return;
        if (!isSessionOpenRef.current) return;
        if (sessionRef.current) {
          try {
            session.sendClientContent({
              turns: '面试开始了，请自我介绍并提出第一个问题。',
              turnComplete: true,
            });
            setAiStatus('thinking');
          } catch (err) {
            console.error('[LiveAPI] Failed to send initial message:', err);
          }
        }
      }, 500);

    } catch (err: any) {
      console.error('[Session] Failed to start:', err);
      setError(err.message || '无法访问麦克风或连接 AI 服务。');
      setAiStatus('disconnected');
      scheduleReconnect('启动失败');
    }
  };

  const handleServerMessage = (message: LiveServerMessage) => {
    const sc = message.serverContent;
    if (!sc) return;

    // Handle interruption
    if (sc.interrupted) {
      console.log('[LiveAPI] Interrupted');
      audioQueueRef.current = [];
      if (playbackContextRef.current) {
        nextPlayTimeRef.current = playbackContextRef.current.currentTime;
      }
      isSpeakingRef.current = false;

      // Flush any pending AI text with interruption marker
      flushPendingAiText(' [被打断]');
      currentTurnRoleRef.current = null;

      setAiStatus('interrupted');
      setTimeout(() => setAiStatus('listening'), 1500);
      return;
    }

    // Handle input transcription (user's spoken text)
    // This arrives asynchronously and may come DURING or AFTER the AI's response
    // We flush user text BEFORE starting a new model turn to maintain order
    if (sc.inputTranscription?.text) {
      // If we were in a model turn, flush any pending AI text first (in case of overlap)
      if (currentTurnRoleRef.current === 'model') {
        flushPendingAiText();
      }
      currentTurnRoleRef.current = 'user';
      pendingUserTextRef.current += sc.inputTranscription.text;
      // Update live preview so user can see real-time transcription as they speak
      setLiveUserText(pendingUserTextRef.current);
    }

    // Handle model audio output
    if (sc.modelTurn?.parts) {
      // If user text is pending (from before this model turn), flush it first
      // and show 'thinking' to indicate AI received the input and is processing
      if (currentTurnRoleRef.current !== 'model') {
        flushPendingUserText(true);
        currentTurnRoleRef.current = 'model';
      }

      for (const part of sc.modelTurn.parts) {
        if (part.inlineData?.data) {
          setAiStatus('speaking');
          isSpeakingRef.current = true;
          playAudioChunk(part.inlineData.data);
        }
      }
    }

    // Handle output transcription (AI's spoken text)
    if (sc.outputTranscription?.text) {
      // Ensure user text is flushed before appending model text
      if (currentTurnRoleRef.current !== 'model') {
        flushPendingUserText(true);
        currentTurnRoleRef.current = 'model';
      }
      pendingAiTextRef.current += sc.outputTranscription.text;
      // Update live preview so AI response text streams in real-time
      setLiveAiText(pendingAiTextRef.current);
    }

    // Handle turn complete
    if (sc.turnComplete) {
      // Flush all pending text in order: user first (if any left), then AI
      flushPendingUserText();
      flushPendingAiText();
      currentTurnRoleRef.current = null;

      // Calculate the actual remaining playback time so we don't cut off audio
      const ctx = playbackContextRef.current;
      let remainingMs = 1500; // fallback minimum
      if (ctx) {
        const remaining = nextPlayTimeRef.current - ctx.currentTime;
        // Add a small buffer (500ms) to ensure the last chunk fully plays out
        remainingMs = Math.max(1500, remaining * 1000 + 500);
      }

      // Set status to listening only after all queued audio has finished playing
      if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = setTimeout(() => {
        isSpeakingRef.current = false;
        setAiStatus('listening');
      }, remainingMs);
    }
  };

  const playAudioChunk = (base64: string) => {
    const ctx = playbackContextRef.current;
    if (!ctx) return;

    // Mark that the AI has genuinely sent audio in this session.
    hasReceivedAiAudioRef.current = true;

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
    const ctx = playbackContextRef.current;
    if (!ctx || audioQueueRef.current.length === 0) return;

    while (audioQueueRef.current.length > 0) {
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
    sessionRunIdRef.current += 1;
    shouldReconnectRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    cleanupSessionResources();
    setIsConnected(false);
    setAiStatus('disconnected');
  };

  const handleEndInterview = () => {
    const finalMessages = [...transcript];
    if (pendingUserTextRef.current.trim()) {
      const text = sanitizeTranscript(pendingUserTextRef.current.trim());
      if (text) finalMessages.push({ role: 'user' as const, text });
      pendingUserTextRef.current = '';
    }
    if (pendingAiTextRef.current.trim()) {
      const text = sanitizeTranscript(pendingAiTextRef.current.trim());
      if (text) finalMessages.push({ role: 'ai' as const, text });
      pendingAiTextRef.current = '';
    }
    setLiveUserText('');
    setLiveAiText('');
    setTranscript(finalMessages);

    stopSession();
    const formattedTranscript = finalMessages.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n');
    onEnd(formattedTranscript);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;

    // Also mute/unmute the actual mic tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
    }

    // When muting, send audioStreamEnd to signal end of stream
    if (newMuted && sessionRef.current && isSessionOpenRef.current) {
      try {
        sessionRef.current.sendRealtimeInput({ audioStreamEnd: true });
      } catch (_) { }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const currentStatus = STATUS_CONFIG[aiStatus];

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-4">
          {/* Connection indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
              {isConnected ? '已连接' : '未连接'}
            </span>
          </div>

          {/* Timer */}
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 font-mono text-xs text-zinc-400">
            {formatTime(elapsedTime)}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {showEndConfirm ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <span className="text-xs text-zinc-400 mr-1">确认结束本次面试？</span>
              <button
                onClick={handleEndInterview}
                className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 border border-red-500/30"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                确认结束
              </button>
              <button
                onClick={() => setShowEndConfirm(false)}
                className="px-4 py-2 bg-white/5 text-zinc-400 hover:bg-white/10 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 border border-white/10"
              >
                <X className="w-3.5 h-3.5" />
                继续面试
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowEndConfirm(true)}
              className="px-5 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 border border-red-500/20 hover:border-red-500/30"
            >
              <Square className="w-3.5 h-3.5" />
              结束面试
            </motion.button>
          )}
        </AnimatePresence>
      </header>

      {/* AI Status Bar */}
      <AnimatePresence mode="wait">
        <motion.div
          key={isMuted ? 'muted' : aiStatus}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`px-6 py-3 border-b border-white/5 flex items-center justify-center gap-3 ${
            isMuted ? 'bg-zinc-500/10' : currentStatus.bgColor
          }`}
        >
          {/* Pulse indicator */}
          <div className="relative flex items-center">
            <motion.div
              animate={{
                scale: [1, 1.8, 1],
                opacity: [0.6, 0, 0.6],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className={`absolute w-3 h-3 rounded-full ${
                isMuted ? 'bg-zinc-500' : currentStatus.pulseColor
              } opacity-30`}
            />
            <div className={`w-2 h-2 rounded-full ${
              isMuted ? 'bg-zinc-500' : currentStatus.pulseColor
            } relative z-10`} />
          </div>

          {isMuted ? (
            <span className="text-zinc-400 flex items-center gap-2 text-sm font-medium">
              <MicOff className="w-4 h-4" />
              麦克风已静音·AI 暂时听不到您
            </span>
          ) : (
            <span className={`${currentStatus.color} flex items-center gap-2 text-sm font-medium`}>
              {currentStatus.icon}
              {currentStatus.label}
              {/* Reconnect countdown badge */}
              {reconnectCountdown !== null && (
                <span className="ml-1 text-xs font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  {reconnectCountdown}s
                </span>
              )}
            </span>
          )}

          {/* Speaking waveform animation */}
          {aiStatus === 'speaking' && (
            <div className="flex items-center gap-0.5 ml-1">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: [4, 16, 4],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeInOut',
                  }}
                  className="w-0.5 bg-blue-400/60 rounded-full"
                  style={{ minHeight: 4 }}
                />
              ))}
            </div>
          )}

          {/* Thinking dots animation */}
          {aiStatus === 'thinking' && (
            <div className="flex items-center gap-1 ml-1">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    opacity: [0.3, 1, 0.3],
                    scale: [0.8, 1.2, 0.8],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: 'easeInOut',
                  }}
                  className="w-1.5 h-1.5 bg-purple-400 rounded-full"
                />
              ))}
            </div>
          )}

          {/* Listening wave animation */}
          {aiStatus === 'listening' && (
            <div className="flex items-center gap-0.5 ml-1">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: [3, 8, 3],
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: 'easeInOut',
                  }}
                  className="w-0.5 bg-green-400/60 rounded-full"
                  style={{ minHeight: 3 }}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* Left: Atmospheric Visualizer */}
        <div className="w-full md:w-1/2 relative flex items-center justify-center border-r border-white/10 p-12">
          {/* Ethereal background glows */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              animate={{
                scale: aiStatus === 'speaking' ? [1, 1.3, 1] : aiStatus === 'listening' ? [1, 1.1, 1] : 1,
                opacity: aiStatus === 'speaking' ? [0.4, 0.7, 0.4] : aiStatus === 'listening' ? [0.2, 0.4, 0.2] : 0.1,
              }}
              transition={{ duration: aiStatus === 'speaking' ? 1.5 : 3, repeat: Infinity, ease: "easeInOut" }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[100px] ${aiStatus === 'speaking' ? 'bg-blue-500/30' :
                  aiStatus === 'thinking' ? 'bg-purple-500/20' :
                    aiStatus === 'listening' ? 'bg-green-500/15' :
                      'bg-orange-500/15'
                }`}
            />
            {/* Secondary glow */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.1, 0.25, 0.1],
                rotate: [0, 180, 360],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-[80px]"
            />
          </div>

          <div className="z-10 text-center">
            {/* Main orb */}
            <motion.div
              animate={{
                scale: aiStatus === 'speaking'
                  ? [1, 1.15, 1]
                  : !isMuted
                    ? [1, 1.03 + (micVolume / 255) * 0.15, 1]
                    : 1,
                boxShadow: aiStatus === 'speaking'
                  ? [
                    '0 0 60px rgba(59,130,246,0.3)',
                    '0 0 120px rgba(59,130,246,0.6)',
                    '0 0 60px rgba(59,130,246,0.3)',
                  ]
                  : !isMuted
                    ? `0 0 ${30 + (micVolume / 255) * 80}px rgba(249,115,22,${0.2 + (micVolume / 255) * 0.4})`
                    : '0 0 20px rgba(255,255,255,0.05)',
              }}
              transition={{
                duration: aiStatus === 'speaking' ? 1 : 0.1,
                ease: aiStatus === 'speaking' ? 'easeInOut' : 'linear',
                repeat: aiStatus === 'speaking' ? Infinity : 0,
              }}
              className={`w-36 h-36 mx-auto rounded-full flex items-center justify-center backdrop-blur-xl border-2 transition-colors duration-500 ${aiStatus === 'speaking'
                  ? 'bg-blue-500/10 border-blue-400/50'
                  : aiStatus === 'thinking'
                    ? 'bg-purple-500/10 border-purple-400/50'
                    : !isMuted
                      ? 'bg-white/10 border-orange-500/40'
                      : 'bg-white/5 border-white/10'
                }`}
            >
              {aiStatus === 'connecting' ? (
                <Loader2 className="w-10 h-10 text-zinc-400 animate-spin" />
              ) : aiStatus === 'speaking' ? (
                <AudioLines className="w-10 h-10 text-blue-400" />
              ) : aiStatus === 'thinking' ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <BrainCircuit className="w-10 h-10 text-purple-400" />
                </motion.div>
              ) : (
                <Mic className={`w-10 h-10 ${!isMuted ? 'text-orange-400' : 'text-zinc-600'}`} />
              )}
            </motion.div>

            <h2 className="mt-8 text-2xl font-light tracking-tight">
              {aiStatus === 'connecting'
                ? '正在建立连接...'
                : aiStatus === 'speaking'
                  ? '面试官正在讲话'
                  : aiStatus === 'thinking'
                    ? 'AI 正在组织语言...'
                    : '请自然地回答问题'}
            </h2>
            <p className="mt-2 text-zinc-500 font-mono text-xs">
              {aiStatus === 'connecting'
                ? '正在连接到 AI 面试官...'
                : isMuted
                  ? '🔇 麦克风已静音'
                  : '🎙️ 麦克风已开启 · 说完后请稍等片刻，AI 会在您停顿后回应'}
            </p>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-left max-w-sm mx-auto"
              >
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-200">{error}</p>
                  {reconnectCountdown !== null && (
                    <p className="text-xs text-amber-400 mt-1 font-mono">
                      {reconnectCountdown > 0 ? `· ${reconnectCountdown} 秒后自动重连` : '· 重连中...'}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            <div className="mt-10 flex flex-col items-center gap-4">
              <div className="flex justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleMute}
                disabled={!isConnected}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${!isMuted
                    ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 hover:from-orange-500/30 hover:to-orange-600/20 text-orange-400 border border-orange-500/30'
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                  } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isMuted ? '取消静音' : '静音'}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowMicTest(prev => !prev)}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg border ${
                  showMicTest
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30'
                    : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
                }`}
                title="麦克风测试"
              >
                <Settings2 className="w-6 h-6" />
              </motion.button>
              </div>

              {/* 我说完了 button — visible when listening and mic is active */}
              <AnimatePresence>
                {isConnected && !isMuted && (aiStatus === 'listening' || aiStatus === 'interrupted') && (
                  <motion.button
                    key="finish-speaking"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.25 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleFinishSpeaking}
                    className="px-5 py-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 hover:border-green-500/30 rounded-full text-sm font-medium transition-all flex items-center gap-2"
                    title="单击通知 AI 您已说完，无需等待静音超时"
                  >
                    <Send className="w-4 h-4" />
                    我说完了
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Mic Info & Test Panel */}
            <AnimatePresence>
              {showMicTest && (
                <motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: 10, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 max-w-sm mx-auto overflow-hidden"
                >
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                    {/* Device name */}
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-zinc-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-0.5">当前麦克风</p>
                        <p className="text-xs text-zinc-300 truncate" title={micDeviceName}>{micDeviceName}</p>
                      </div>
                    </div>

                    {/* Real-time volume meter */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                          <Volume2 className="w-3 h-3" />
                          实时音量
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${
                          micTestStatus === 'good' ? 'text-green-400' :
                          micTestStatus === 'low' ? 'text-amber-400' :
                          micTestStatus === 'silent' ? 'text-red-400' : 'text-zinc-500'
                        }`}>
                          {micTestStatus === 'good' ? '✓ 正常' :
                           micTestStatus === 'low' ? '⚠ 音量偏低' :
                           micTestStatus === 'silent' ? '✗ 未检测到声音' : '等待中...'}
                        </span>
                      </div>

                      {/* Volume bar */}
                      <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <motion.div
                          className={`h-full rounded-full ${
                            micVolume > 30 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                            micVolume > 5 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                            'bg-red-500/50'
                          }`}
                          animate={{ width: `${Math.min(100, (micVolume / 255) * 100)}%` }}
                          transition={{ duration: 0.05 }}
                        />
                      </div>

                      {/* Scale markers */}
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px] text-zinc-600">静音</span>
                        <span className="text-[9px] text-zinc-600">正常</span>
                        <span className="text-[9px] text-zinc-600">大声</span>
                      </div>
                    </div>

                    {/* Mic test tip */}
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      💡 对着麦克风说几句话，观察音量条是否有变化。绿色表示正常，如果一直红色说明麦克风未接收到声音。
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Live Transcript */}
        <div className="w-full md:w-1/2 bg-zinc-900/50 flex flex-col overflow-hidden">
          <div className="px-8 pt-6 pb-4 flex items-center gap-2 text-zinc-400 font-mono text-xs uppercase tracking-widest border-b border-white/5">
            <MessageSquare className="w-4 h-4" />
            实时对话记录
            {transcript.length > 0 && (
              <span className="ml-auto text-zinc-600">
                {transcript.length} 条消息
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {transcript.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                <motion.div
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <MessageSquare className="w-12 h-12 mb-4 text-zinc-700" />
                </motion.div>
                <p className="font-mono text-sm">等待对话开始...</p>
                <p className="font-mono text-xs text-zinc-700 mt-2">
                  AI 面试官将会先自我介绍并提出第一个问题
                </p>
              </div>
            )}

            {transcript.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <span className={`text-[10px] uppercase tracking-widest mb-1.5 font-semibold ${msg.role === 'user' ? 'text-orange-400/80' : 'text-blue-400/80'
                  }`}>
                  {msg.role === 'user' ? '👤 你' : '🤖 面试官'}
                </span>
                <div className={`p-4 rounded-2xl max-w-[90%] text-sm leading-relaxed ${msg.role === 'user'
                    ? 'bg-gradient-to-br from-orange-500/15 to-orange-600/5 border border-orange-500/20 text-orange-50 rounded-tr-sm'
                    : 'bg-gradient-to-br from-white/8 to-white/3 border border-white/10 text-zinc-300 rounded-tl-sm'
                  }`}>
                  {msg.text}
                </div>
              </motion.div>
            ))}

            {/* Live user transcription draft bubble — shown in real-time as user speaks */}
            <AnimatePresence>
              {liveUserText.trim() && (
                <motion.div
                  key="live-user"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-end"
                >
                  <span className="text-[10px] uppercase tracking-widest mb-1.5 font-semibold text-orange-400/50 flex items-center gap-1">
                    👤 你
                    <span className="inline-flex items-center gap-0.5 ml-1">
                      {[0,1,2].map(i => (
                        <motion.span
                          key={i}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                          className="w-1 h-1 bg-orange-400/60 rounded-full inline-block"
                        />
                      ))}
                    </span>
                  </span>
                  <div className="p-4 rounded-2xl max-w-[90%] text-sm leading-relaxed bg-orange-500/8 border border-orange-500/15 text-orange-100/60 rounded-tr-sm italic">
                    {sanitizeTranscript(liveUserText) || liveUserText}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live AI transcription draft bubble — streams in as AI speaks */}
            <AnimatePresence>
              {liveAiText.trim() && (
                <motion.div
                  key="live-ai"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-start"
                >
                  <span className="text-[10px] uppercase tracking-widest mb-1.5 font-semibold text-blue-400/50 flex items-center gap-1">
                    🤖 面试官
                    <span className="inline-flex items-center gap-0.5 ml-1">
                      {[0,1,2].map(i => (
                        <motion.span
                          key={i}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                          className="w-1 h-1 bg-blue-400/60 rounded-full inline-block"
                        />
                      ))}
                    </span>
                  </span>
                  <div className="p-4 rounded-2xl max-w-[90%] text-sm leading-relaxed bg-white/4 border border-white/8 text-zinc-400/80 rounded-tl-sm italic">
                    {sanitizeTranscript(liveAiText) || liveAiText}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={transcriptEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
