/**
 * ElevenLabs Voice Interview Component — SDK Version
 *
 * Uses the @11labs/client SDK for direct programmatic control.
 * This gives us the EXACT same experience as the ElevenLabs dashboard:
 * - Auto-start conversation on mount (after mic permission)
 * - Real-time speaking/listening mode tracking
 * - Full audio control (volume, mute)
 * - No floating widget bubble — custom UI integrated into page
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Conversation } from '@11labs/client';
import { useAuth } from '@/contexts/AuthContext';
import { saveBotInterviewResult } from '@/lib/firebaseService';
import {
  isElevenLabsAvailable,
  startSession,
  endSession,
  getAgentId,
  getUsageStats,
} from '@/utils/elevenLabsService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Mic,
  MicOff,
  PhoneOff,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Volume2,
  BarChart3,
  ArrowLeft,
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react';

interface ElevenLabsInterviewProps {
  candidateName: string;
  role: string;
  isFirstTime: boolean;
  onFallbackToFriede: () => void;
  onComplete: () => void;
}

export default function ElevenLabsInterview({
  candidateName,
  role,
  isFirstTime,
  onFallbackToFriede,
  onComplete,
}: ElevenLabsInterviewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const webcamRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionStartRef = useRef<number>(0);
  const conversationRef = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(null);

  const [status, setStatus] = useState<'loading' | 'requesting-mic' | 'connecting' | 'active' | 'ended' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [agentMode, setAgentMode] = useState<'listening' | 'speaking'>('listening');
  const [isMuted, setIsMuted] = useState(false);
  const [webcamReady, setWebcamReady] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [volume, setVolume] = useState(1);
  const [avatarError, setAvatarError] = useState(false);
  const [conversationLog, setConversationLog] = useState<Array<{
    speaker: 'user' | 'friede';
    text: string;
    timestamp: number;
  }>>([]);
  const [feedbackScore, setFeedbackScore] = useState<{
    overall: number;
    communication: number;
    engagement: number;
    clarity: number;
    strengths: string[];
    improvements: string[];
  } | null>(null);

  void isFirstTime;

  // ==================== WEBCAM ====================
  // Start stream immediately on mount (before active screen renders)
  useEffect(() => {
    const initWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        streamRef.current = stream;
        // Attach right away if the video element is already in the DOM
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
          webcamRef.current.play().catch(() => {});
          setWebcamReady(true);
        }
      } catch (err) {
        console.warn('📹 Webcam not available:', err);
      }
    };
    initWebcam();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Re-attach stream whenever the active screen renders the <video> element
  useEffect(() => {
    if (status === 'active' && streamRef.current && webcamRef.current && !webcamReady) {
      webcamRef.current.srcObject = streamRef.current;
      webcamRef.current.onloadedmetadata = () => {
        webcamRef.current?.play().catch(() => {});
        setWebcamReady(true);
      };
      webcamRef.current.play().catch(() => {});
    }
  }, [status, webcamReady]);

  // ==================== TIMER ====================
  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(() => {
      if (sessionStartRef.current > 0) {
        setElapsedTime(Math.floor((Date.now() - sessionStartRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // ==================== SAVE RESULTS ====================
  const handleInterviewEnd = useCallback(async (log?: typeof conversationLog) => {
    endSession();
    const finalLog = log ?? conversationLog;
    const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000);

    // ── Compute score from conversation ──
    const userMsgs = finalLog.filter(m => m.speaker === 'user');
    const avgLen = userMsgs.length
      ? userMsgs.reduce((s, m) => s + m.text.split(' ').length, 0) / userMsgs.length
      : 0;
    const engagementScore = Math.min(100, Math.round((userMsgs.length / Math.max(1, finalLog.length * 0.5)) * 100));
    const clarityScore = Math.min(100, Math.round(40 + Math.min(60, avgLen * 2)));
    const durationBonus = Math.min(20, Math.floor(duration / 30) * 2);
    const communicationScore = Math.min(100, Math.round(50 + durationBonus + Math.min(30, userMsgs.length * 3)));
    const overall = Math.round((engagementScore + clarityScore + communicationScore) / 3);

    const strengths: string[] = [];
    const improvements: string[] = [];
    if (userMsgs.length >= 5) strengths.push('Actively participated throughout the interview');
    else improvements.push('Try to give more detailed answers');
    if (avgLen >= 15) strengths.push('Provided well-elaborated responses');
    else improvements.push('Expand your answers with more detail and examples');
    if (duration >= 120) strengths.push('Maintained good interview engagement time');
    else improvements.push('Aim for longer, more detailed conversations');
    if (communicationScore >= 70) strengths.push('Strong communication and clarity');
    else improvements.push('Work on structuring your answers more clearly');
    if (strengths.length === 0) strengths.push('Completed the voice AI interview session');

    setFeedbackScore({ overall, communication: communicationScore, engagement: engagementScore, clarity: clarityScore, strengths, improvements });
    setStatus('ended');

    if (user) {
      try {
        await saveBotInterviewResult({
          userId: user.id || user.email,
          candidateName,
          role,
          conversationLog: finalLog.length > 0 ? finalLog : [{
            speaker: 'friede',
            text: `[ElevenLabs Voice Interview - Duration: ${Math.floor(duration / 60)}m ${duration % 60}s]`,
            timestamp: Date.now(),
          }],
          feedback: {
            overallScore: overall,
            strengths,
            improvements,
            detailedFeedback: `Voice interview completed via ElevenLabs AI (${Math.floor(duration / 60)}m ${duration % 60}s). Overall score: ${overall}/100.`,
          },
          completedAt: new Date().toISOString(),
          interviewType: 'elevenlabs-voice',
        }, user.id || user.email);
      } catch (err) {
        console.error('❌ Failed to save ElevenLabs interview:', err);
      }
    }
  }, [user, candidateName, role, conversationLog]);

  // ==================== END CALL ====================
  const handleManualEnd = useCallback(async () => {
    // Capture log before async teardown to avoid stale closure
    const currentLog = conversationLog;
    try {
      if (conversationRef.current) {
        await conversationRef.current.endSession();
        conversationRef.current = null;
      }
    } catch (err) {
      console.warn('Error ending ElevenLabs session:', err);
    }
    handleInterviewEnd(currentLog);
  }, [handleInterviewEnd, conversationLog]);

  // ==================== MUTE / VOLUME ====================
  const toggleMute = useCallback(async () => {
    // Mute by setting volume to 0, unmute by restoring
    if (conversationRef.current) {
      try {
        if (isMuted) {
          await conversationRef.current.setVolume({ volume });
        } else {
          await conversationRef.current.setVolume({ volume: 0 });
        }
        setIsMuted(!isMuted);
      } catch (err) {
        console.warn('Error toggling mute:', err);
      }
    }
  }, [isMuted, volume]);

  const changeVolume = useCallback(async (newVolume: number) => {
    setVolume(newVolume);
    if (conversationRef.current && !isMuted) {
      try {
        await conversationRef.current.setVolume({ volume: newVolume });
      } catch (err) {
        console.warn('Error changing volume:', err);
      }
    }
  }, [isMuted]);

  // ==================== MAIN INIT — START CONVERSATION ====================
  useEffect(() => {
    let cancelled = false;

    const startConversation = async () => {
      // Step 1: Check rate limits
      const availability = isElevenLabsAvailable();
      if (!availability.available) {
        setErrorMsg(availability.reason || 'ElevenLabs unavailable');
        setStatus('error');
        setTimeout(() => onFallbackToFriede(), 3000);
        return;
      }

      // Step 2: Request microphone permission
      setStatus('requesting-mic');
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.error('❌ Microphone permission denied:', err);
        if (cancelled) return;
        setErrorMsg('Microphone permission denied. Voice AI requires microphone access.');
        setStatus('error');
        setTimeout(() => onFallbackToFriede(), 3000);
        return;
      }

      if (cancelled) return;
      setStatus('connecting');

      // Step 3: Start ElevenLabs session tracking
      startSession(candidateName, role);
      sessionStartRef.current = Date.now();

      // Step 4: Start the ElevenLabs Conversation using the SDK
      try {
        const agentId = getAgentId();
        console.log('🎙️ Starting ElevenLabs conversation with agent:', agentId);

        const conversation = await Conversation.startSession({
          agentId,
          onConnect: () => {
            console.log('✅ ElevenLabs connected!');
            if (!cancelled) {
              setStatus('active');
            }
          },
          onDisconnect: () => {
            console.log('📞 ElevenLabs disconnected');
            if (!cancelled) {
              handleInterviewEnd(undefined);
            }
          },
          onError: (error: unknown) => {
            console.error('❌ ElevenLabs error:', error);
            if (!cancelled) {
              const errMsg = error instanceof Error ? error.message : String(error);
              setErrorMsg(`Voice AI error: ${errMsg}`);
              setStatus('error');
              setTimeout(() => onFallbackToFriede(), 3000);
            }
          },
          onModeChange: (mode: { mode: 'speaking' | 'listening' }) => {
            if (!cancelled) {
              setAgentMode(mode.mode);
            }
          },
          onMessage: (message: { source: string; message: string }) => {
            if (!cancelled) {
              setConversationLog(prev => [...prev, {
                speaker: message.source === 'user' ? 'user' : 'friede',
                text: message.message,
                timestamp: Date.now(),
              }]);
            }
          },
        });

        if (cancelled) {
          await conversation.endSession();
          return;
        }

        conversationRef.current = conversation;
        console.log('✅ ElevenLabs conversation session active');

      } catch (err) {
        console.error('❌ Failed to start ElevenLabs conversation:', err);
        if (cancelled) return;
        const errMsg = err instanceof Error ? err.message : String(err);
        setErrorMsg(`Failed to connect: ${errMsg}`);
        setStatus('error');
        setTimeout(() => onFallbackToFriede(), 3000);
      }
    };

    startConversation();

    return () => {
      cancelled = true;
      if (conversationRef.current) {
        conversationRef.current.endSession().catch(() => {});
        conversationRef.current = null;
      }
      endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==================== HELPERS ====================
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const stats = getUsageStats();

  // ==================== RENDER: ERROR ====================
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-gray-900 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
              <div>
                <CardTitle>Voice AI Unavailable</CardTitle>
                <CardDescription>{errorMsg}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Automatically switching to FRIEDE text+voice interview...
            </p>
            <div className="flex gap-3">
              <Button onClick={onFallbackToFriede} className="flex-1">
                Switch to FRIEDE Now
              </Button>
              <Button variant="outline" onClick={() => navigate('/practice')}>
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==================== RENDER: LOADING / CONNECTING ====================
  if (status === 'loading' || status === 'requesting-mic' || status === 'connecting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-8">
        <div className="text-center space-y-6">
          <div className="relative mx-auto w-24 h-24">
            <Loader2 className="w-24 h-24 text-blue-400 animate-spin" />
            {status === 'requesting-mic' && (
              <Mic className="w-8 h-8 text-blue-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
            {status === 'connecting' && (
              <Phone className="w-8 h-8 text-green-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">
              {status === 'loading' && 'Initializing...'}
              {status === 'requesting-mic' && 'Allow Microphone Access'}
              {status === 'connecting' && 'Connecting to FRIEDE...'}
            </h2>
            <p className="text-blue-300">
              {status === 'loading' && 'Checking availability...'}
              {status === 'requesting-mic' && 'Please allow microphone access when prompted'}
              {status === 'connecting' && `Setting up voice interview for ${candidateName}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDER: ENDED ====================
  if (status === 'ended') {
    const score = feedbackScore;
    const scoreColor = (n: number) => n >= 80 ? 'text-green-400' : n >= 60 ? 'text-yellow-400' : 'text-red-400';
    const scoreBg = (n: number) => n >= 80 ? 'bg-green-500' : n >= 60 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-4">
          {/* Header */}
          <div className="flex items-center gap-4 bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <div className="w-14 h-14 rounded-full bg-green-600/20 border border-green-600/40 flex items-center justify-center shrink-0">
              <CheckCircle className="w-7 h-7 text-green-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-white text-xl font-bold">Interview Complete!</h2>
              <p className="text-gray-400 text-sm">Great job, {candidateName} · {role}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs">Duration</p>
              <p className="text-white text-xl font-mono font-bold">{formatTime(elapsedTime)}</p>
            </div>
          </div>

          {/* Score Cards */}
          {score && (
            <>
              {/* Overall Score */}
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex items-center gap-6">
                <div className="relative w-24 h-24 shrink-0">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1f2937" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={score.overall >= 80 ? '#22c55e' : score.overall >= 60 ? '#eab308' : '#ef4444'}
                      strokeWidth="3"
                      strokeDasharray={`${score.overall} ${100 - score.overall}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${scoreColor(score.overall)}`}>{score.overall}</span>
                    <span className="text-gray-500 text-[10px]">/100</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-gray-400 text-sm mb-1">Overall Score</p>
                  <p className={`text-3xl font-bold ${scoreColor(score.overall)}`}>{score.overall >= 80 ? 'Excellent' : score.overall >= 60 ? 'Good' : 'Needs Work'}</p>
                  <div className="flex gap-3 mt-3">
                    {(['communication', 'engagement', 'clarity'] as const).map(k => (
                      <div key={k} className="flex-1">
                        <p className="text-gray-500 text-[10px] capitalize mb-1">{k}</p>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${scoreBg(score[k])}`} style={{ width: `${score[k]}%` }} />
                        </div>
                        <p className={`text-xs font-semibold mt-0.5 ${scoreColor(score[k])}`}>{score[k]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-900/20 border border-green-800/30 rounded-2xl p-4">
                  <p className="text-green-400 text-xs font-bold uppercase tracking-wider mb-3">✅ Strengths</p>
                  <ul className="space-y-2">
                    {score.strengths.map((s, i) => (
                      <li key={i} className="text-green-100 text-xs flex gap-2">
                        <span className="text-green-500 mt-0.5">•</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-2xl p-4">
                  <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-3">💡 Improve</p>
                  <ul className="space-y-2">
                    {score.improvements.map((s, i) => (
                      <li key={i} className="text-yellow-100 text-xs flex gap-2">
                        <span className="text-yellow-500 mt-0.5">•</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          {/* Conversation summary */}
          {conversationLog.length > 0 && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 max-h-52 overflow-y-auto">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Conversation Highlights</p>
              <div className="space-y-2">
                {conversationLog.slice(-8).map((msg, i) => (
                  <div key={i} className={`text-xs ${msg.speaker === 'friede' ? 'text-blue-400' : 'text-green-400'}`}>
                    <span className="font-semibold">{msg.speaker === 'friede' ? 'FRIEDE' : 'You'}:</span>{' '}
                    {msg.text.slice(0, 160)}{msg.text.length > 160 ? '...' : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button onClick={() => navigate('/practice')} className="flex-1 bg-blue-600 hover:bg-blue-700">
              Back to Dashboard
            </Button>
            <Button variant="outline" onClick={onComplete} className="flex-1 border-gray-700 text-gray-300 hover:text-white">
              New Interview
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDER: ACTIVE INTERVIEW ====================
  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { handleManualEnd(); navigate('/practice'); }}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Exit
          </Button>
          <div className="h-6 w-px bg-gray-700" />
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              agentMode === 'speaking' ? 'bg-blue-500' : 'bg-green-500'
            }`} />
            <span className={`text-sm font-medium ${
              agentMode === 'speaking' ? 'text-blue-400' : 'text-green-400'
            }`}>
              {agentMode === 'speaking' ? '🔊 FRIEDE is Speaking...' : '🎤 Listening to you...'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-lg font-mono text-white bg-gray-800 px-3 py-1 rounded">
            {formatTime(elapsedTime)}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStats(!showStats)}
            className="text-gray-400 hover:text-white"
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleManualEnd}
            className="gap-2 bg-red-600 hover:bg-red-700"
          >
            <PhoneOff className="w-4 h-4" />
            End Interview
          </Button>
        </div>
      </div>

      {/* ── Usage Stats Banner ──────────────────────────────────────── */}
      {showStats && (
        <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-2 shrink-0">
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <span>Monthly: {stats.charsUsed}/{stats.monthlyLimit} chars ({stats.percentUsed}%)</span>
            <span>Today: {stats.sessionsToday} sessions</span>
            <span>Total: {stats.totalSessions}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, stats.percentUsed)}%`,
                  backgroundColor: stats.percentUsed > 80 ? '#ef4444' : stats.percentUsed > 50 ? '#f59e0b' : '#22c55e',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Main Two-Column Layout ──────────────────────────────────── */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">

        {/* ════════════ LEFT PANEL (42%) ════════════ */}
        <div className="w-[42%] flex flex-col gap-3 min-h-0">

          {/* TOP LEFT — Webcam Feed */}
          <div className="flex-[3] relative bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-xl min-h-0">
            <video
              ref={webcamRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            {!webcamReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 gap-3">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
                  <User className="w-8 h-8 text-gray-500" />
                </div>
                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                <p className="text-gray-500 text-xs">Starting camera...</p>
              </div>
            )}
            {/* Candidate label */}
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <p className="text-white text-sm font-semibold">{candidateName}</p>
              <p className="text-gray-300 text-xs">{role}</p>
            </div>
            {/* Camera live badge */}
            {webcamReady && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-[10px] font-medium">LIVE</span>
              </div>
            )}
          </div>

          {/* BOTTOM LEFT — FRIEDE AI Avatar */}
          <div className={`flex-[2] relative rounded-2xl overflow-hidden border shadow-xl flex flex-col items-center justify-center gap-3 min-h-0 transition-all duration-500 ${
            agentMode === 'speaking'
              ? 'bg-gradient-to-br from-blue-950 via-blue-900/60 to-gray-900 border-blue-700/50 shadow-blue-900/40'
              : 'bg-gradient-to-br from-purple-950 via-purple-900/40 to-gray-900 border-purple-800/40'
          }`}>
            {/* Avatar with animated ring */}
            <div className={`relative transition-all duration-500 ${
              agentMode === 'speaking' ? 'scale-105' : 'scale-100'
            }`}>
              {/* Outer pulse rings when speaking */}
              {agentMode === 'speaking' && (
                <>
                  <div className="absolute -inset-2 rounded-full border-4 border-blue-400/50 animate-ping" />
                  <div className="absolute -inset-4 rounded-full border-2 border-blue-300/20 animate-ping" style={{ animationDelay: '0.4s' }} />
                </>
              )}
              {/* Listening idle ring */}
              {agentMode === 'listening' && (
                <div className="absolute -inset-1.5 rounded-full border-2 border-purple-500/40 animate-pulse" />
              )}
              {/* Avatar image or fallback */}
              <div className={`w-24 h-24 rounded-full overflow-hidden z-10 relative transition-all duration-500 ${
                agentMode === 'speaking'
                  ? 'ring-4 ring-blue-400/80 shadow-2xl shadow-blue-500/60'
                  : 'ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/30'
              }`}>
                {!avatarError ? (
                  <img
                    src="/friede-avatar.png"
                    alt="FRIEDE"
                    className="w-full h-full object-cover object-[center_10%]"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${
                    agentMode === 'speaking'
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-400'
                      : 'bg-gradient-to-br from-purple-600 to-blue-600'
                  }`}>
                    {agentMode === 'speaking'
                      ? <Volume2 className="w-10 h-10 text-white" />
                      : <Mic className="w-10 h-10 text-white" />
                    }
                  </div>
                )}
              </div>
              {/* Speaking glow overlay */}
              {agentMode === 'speaking' && (
                <div className="absolute inset-0 rounded-full bg-blue-400/10 animate-pulse z-20 pointer-events-none" />
              )}
            </div>

            {/* FRIEDE label */}
            <div className="text-center z-10">
              <p className="text-white text-sm font-bold tracking-wide">FRIEDE</p>
              <p className={`text-xs font-medium transition-colors duration-300 ${
                agentMode === 'speaking' ? 'text-blue-300' : 'text-green-400'
              }`}>
                {agentMode === 'speaking' ? '🔊 Speaking...' : '🎤 Listening — speak now!'}
              </p>
            </div>

            {/* Audio waveform */}
            <div className="flex items-end gap-[3px] h-8 z-10">
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    agentMode === 'speaking' ? 'bg-blue-400' : 'bg-purple-400/40'
                  }`}
                  style={{
                    height: agentMode === 'speaking'
                      ? `${8 + ((i * 7 + Date.now() / 120) % 24)}px`
                      : '4px',
                  }}
                />
              ))}
            </div>
          </div>

        </div>
        {/* ════════════ END LEFT PANEL ════════════ */}

        {/* ════════════ RIGHT PANEL (58%) ════════════ */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">

          {/* TOP RIGHT — FRIEDE Status Card */}
          <div className={`rounded-2xl border p-5 flex items-center gap-4 shrink-0 transition-all duration-500 ${
            agentMode === 'speaking'
              ? 'bg-gradient-to-br from-blue-900/50 to-gray-900 border-blue-700/40'
              : 'bg-gradient-to-br from-purple-900/40 to-gray-900 border-purple-800/30'
          }`}>
            {/* Avatar thumbnail with ring animation */}
            <div className="relative shrink-0">
              {agentMode === 'speaking' && (
                <div className="absolute -inset-1.5 rounded-full border-2 border-blue-400/60 animate-ping" />
              )}
              <div className={`w-14 h-14 rounded-full overflow-hidden transition-all duration-500 ${
                agentMode === 'speaking'
                  ? 'ring-2 ring-blue-400/80 shadow-lg shadow-blue-500/40'
                  : 'ring-2 ring-purple-500/40 shadow-md shadow-purple-500/20'
              }`}>
                {!avatarError ? (
                  <img
                    src="/friede-avatar.png"
                    alt="FRIEDE"
                    className="w-full h-full object-cover object-[center_10%]"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${
                    agentMode === 'speaking'
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-400'
                      : 'bg-gradient-to-br from-purple-600 to-blue-600'
                  }`}>
                    <Mic className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-white text-base font-bold">FRIEDE Voice AI</h3>
              <p className="text-gray-400 text-xs">Powered by ElevenLabs • Voice: George</p>
              <p className={`text-xs mt-1 font-semibold ${
                agentMode === 'speaking' ? 'text-blue-400' : 'text-green-400'
              }`}>
                {agentMode === 'speaking' ? '🔊 Speaking...' : '🎤 Listening — speak now!'}
              </p>
            </div>
            {/* Animated waveform */}
            <div className="flex items-end gap-[3px] h-10">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    agentMode === 'speaking' ? 'bg-blue-400' : 'bg-gray-600'
                  }`}
                  style={{
                    height: agentMode === 'speaking'
                      ? `${6 + ((i * 5 + Date.now() / 100) % 20)}px`
                      : '4px',
                  }}
                />
              ))}
            </div>
          </div>

          {/* MIDDLE RIGHT — Conversation Toggle Button */}
          <div className="shrink-0">
            <button
              onClick={() => setShowConversation(v => !v)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-medium ${
                showConversation
                  ? 'bg-gray-800 border-gray-600 text-white'
                  : 'bg-gray-900/60 border-gray-700/50 text-gray-300 hover:text-white hover:border-gray-600'
              }`}
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Live Conversation
                {conversationLog.length > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {conversationLog.length}
                  </span>
                )}
              </span>
              {showConversation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* MIDDLE RIGHT — Conversation Panel (togglable) */}
          <div
            className={`rounded-2xl border border-gray-800 bg-gray-900 flex flex-col overflow-hidden transition-all duration-300 ${
              showConversation ? 'flex-1 min-h-0 opacity-100' : 'h-0 opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversationLog.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  <div className="text-center">
                    <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>FRIEDE is starting the conversation...</p>
                    <p className="text-xs mt-1 text-gray-600">Speak naturally when it's your turn</p>
                  </div>
                </div>
              ) : (
                conversationLog.map((msg, i) => (
                  <div key={i} className={`flex ${
                    msg.speaker === 'user' ? 'justify-end' : 'justify-start'
                  }`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.speaker === 'user'
                        ? 'bg-green-600/20 border border-green-700/30 text-green-100'
                        : 'bg-blue-600/20 border border-blue-700/30 text-blue-100'
                    }`}>
                      <p className={`text-[10px] font-semibold mb-1 ${
                        msg.speaker === 'user' ? 'text-green-400' : 'text-blue-400'
                      }`}>
                        {msg.speaker === 'user' ? candidateName : 'FRIEDE'}
                      </p>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* PLACEHOLDER shown when conversation is hidden */}
          <div className={`flex-1 rounded-2xl border border-gray-800 bg-gray-900/40 flex flex-col items-center justify-center gap-5 p-6 min-h-0 transition-all duration-300 ${
            showConversation ? 'hidden' : 'flex'
          }`}>
            <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center">
              <Mic className="w-7 h-7 text-purple-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white text-sm font-semibold">Your interview is in progress</p>
              <p className="text-gray-500 text-xs">FRIEDE is evaluating your responses in real-time</p>
            </div>
            <div className="w-full max-w-xs bg-gray-800/60 rounded-xl p-4 space-y-2">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Quick Tips</p>
              {[
                '🎯 Stay on topic and be concise',
                '💬 Use examples from past experience',
                '⏱️ Aim for 60–90 second answers',
                '🧠 Think aloud when solving problems',
              ].map((tip, i) => (
                <p key={i} className="text-gray-400 text-xs">{tip}</p>
              ))}
            </div>
          </div>

          {/* BOTTOM RIGHT — Interview Tips (always visible, compact) */}
          <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-3 shrink-0">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
              <p>• Speak clearly and naturally</p>
              <p>• Wait for FRIEDE to finish speaking</p>
              <p>• Take a breath before answering</p>
              <p>• Ask for clarification if needed</p>
            </div>
          </div>

        </div>
        {/* ════════════ END RIGHT PANEL ════════════ */}

      </div>
      {/* ── End Main Layout ─────────────────────────────────────────── */}

      {/* ── Global Bottom Controls ──────────────────────────────────── */}
      <div className="flex items-center justify-center gap-6 px-6 py-3 bg-gray-900 border-t border-gray-800 shrink-0">
        <Button
          variant={isMuted ? 'destructive' : 'ghost'}
          size="sm"
          onClick={toggleMute}
          className={`gap-2 min-w-[100px] ${
            !isMuted ? 'text-green-400 hover:text-green-300 hover:bg-green-900/20' : ''
          }`}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {isMuted ? 'Unmute' : 'Mic On'}
        </Button>

        <div className="h-6 w-px bg-gray-700" />

        <div className="flex items-center gap-3">
          <Volume2 className="w-4 h-4 text-gray-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => changeVolume(parseFloat(e.target.value))}
            className="w-28 accent-blue-500 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
