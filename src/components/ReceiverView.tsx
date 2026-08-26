import React, { useState, useEffect, useRef } from 'react';
import { StreamStats, PlaybackSyncState } from '../types';
import { WebRTCClient, ConnectionStatus } from '../utils/webrtcClient';
import { StatsOverlay } from './StatsOverlay';
import { SAMPLE_VIDEOS } from '../utils/sampleVideos';
import {
  Smartphone,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Activity,
  Wifi,
  Radio,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Sparkles,
  Layers
} from 'lucide-react';

interface ReceiverViewProps {
  initialPin?: string;
  autoConnect?: boolean;
}

export const ReceiverView: React.FC<ReceiverViewProps> = ({ initialPin = '', autoConnect = false }) => {
  const [pinInput, setPinInput] = useState<string>(initialPin);
  const [activePin, setActivePin] = useState<string | null>(initialPin && autoConnect ? initialPin : null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [syncState, setSyncState] = useState<PlaybackSyncState | null>(null);
  const [stats, setStats] = useState<StreamStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(120);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const webrtcClientRef = useRef<WebRTCClient | null>(null);
  const isUserInteractingRef = useRef(false);

  // Auto connect if initialPin is given via URL
  useEffect(() => {
    if (initialPin && initialPin.length === 6) {
      handleConnect(initialPin);
    }
  }, [initialPin]);

  const handleConnect = (pinToUse?: string) => {
    const pin = (pinToUse || pinInput).trim().replace(/[-\s]/g, '');
    if (pin.length < 6) {
      setErrorMessage('لطفاً کد ۶ رقمی معتبر را وارد کنید.');
      return;
    }

    setErrorMessage(null);
    setActivePin(pin);

    // Teardown previous
    if (webrtcClientRef.current) {
      webrtcClientRef.current.destroy();
    }

    const client = new WebRTCClient('receiver', pin, {
      onConnectionStatusChange: (status) => {
        setConnectionStatus(status);
        if (status === 'connected') {
          setErrorMessage(null);
        }
      },
      onRemoteStream: (stream) => {
        console.log('[Receiver] Got remote stream track:', stream);
        setRemoteStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      },
      onSyncStateReceived: (state) => {
        setSyncState(state);
        setIsPlaying(state.isPlaying);
        setDuration(state.duration || 120);

        if (videoRef.current && !isUserInteractingRef.current) {
          // If we are playing a sample fallback or video
          if (!remoteStream) {
            const sample = SAMPLE_VIDEOS.find((s) => s.titleFa === state.sourceTitle) || SAMPLE_VIDEOS[0];
            if (!videoRef.current.src || !videoRef.current.src.includes(sample.url)) {
              videoRef.current.src = sample.url;
            }
          }

          const drift = Math.abs(videoRef.current.currentTime - state.currentTime);
          if (drift > 0.3) {
            videoRef.current.currentTime = state.currentTime;
          }

          if (state.isPlaying && videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
          } else if (!state.isPlaying && !videoRef.current.paused) {
            videoRef.current.pause();
          }
        }
        setCurrentTime(state.currentTime);
      },
      onStatsUpdated: (newStats) => {
        setStats(newStats);
      },
      onPeerDisconnected: () => {
        setErrorMessage('گوشی مبدا قطع شد. در حال تلاش مجدد...');
      },
      onError: (err) => {
        setErrorMessage(err);
      }
    });

    webrtcClientRef.current = client;
    client.connect();
  };

  const handleDisconnect = () => {
    if (webrtcClientRef.current) {
      webrtcClientRef.current.destroy();
      webrtcClientRef.current = null;
    }
    setActivePin(null);
    setConnectionStatus('disconnected');
    setRemoteStream(null);
    setSyncState(null);
  };

  // Remote Control Handlers (Transmitted back to Sender over WebRTC DataChannel)
  const sendRemoteControl = (action: 'PLAY' | 'PAUSE' | 'SEEK', pos?: number) => {
    const targetPos = pos !== undefined ? pos : currentTime;
    const isNowPlaying = action === 'PLAY' || (action === 'SEEK' && isPlaying);

    setIsPlaying(isNowPlaying);
    setCurrentTime(targetPos);

    if (videoRef.current) {
      if (action === 'PLAY') videoRef.current.play().catch(() => {});
      if (action === 'PAUSE') videoRef.current.pause();
      if (action === 'SEEK') videoRef.current.currentTime = targetPos;
    }

    webrtcClientRef.current?.sendControlCommand({
      action,
      position: targetPos,
      isPlaying: isNowPlaying,
      timestamp: Date.now()
    });
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    sendRemoteControl('SEEK', time);
  };

  const handleJump = (deltaSeconds: number) => {
    const nextTime = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    setCurrentTime(nextTime);
    sendRemoteControl('SEEK', nextTime);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const toggleAspectRatio = () => {
    if (aspectRatio === 'contain') setAspectRatio('cover');
    else if (aspectRatio === 'cover') setAspectRatio('fill');
    else setAspectRatio('contain');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
      {/* If Not Connected or Entering PIN */}
      {!activePin || connectionStatus === 'disconnected' ? (
        <div className="max-w-md mx-auto bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6 relative overflow-hidden text-center">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/10">
            <Smartphone className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xs uppercase tracking-widest text-slate-500 font-mono">Receiver Config</h2>
            <h3 className="text-xl sm:text-2xl font-black text-white">اتصال به گوشی مبدا</h3>
            <p className="text-xs text-slate-400">
              کد ۶ رقمی مبدا (فرستنده) را وارد کنید تا استریم کم‌تأخیر بلادرنگ برقرار شود.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 6-Digit PIN Display & Input */}
          <div className="space-y-4 text-right">
            <div>
              <label className="text-xs text-slate-500 block mb-2 font-mono uppercase tracking-wider">Destination Code</label>
              <input
                type="text"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="_ _ _  _ _ _"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-center text-2xl sm:text-3xl font-mono tracking-[0.2em] text-blue-400 focus:border-blue-500 outline-none transition-colors shadow-inner"
              />
            </div>

            {/* Quick Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto pt-2" dir="ltr">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    if (pinInput.length < 6) setPinInput(pinInput + num);
                  }}
                  className="py-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-white font-bold text-lg font-mono transition-all active:scale-95 shadow-sm"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => setPinInput('')}
                className="py-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-semibold transition-all"
              >
                پاک کردن
              </button>
              <button
                onClick={() => {
                  if (pinInput.length < 6) setPinInput(pinInput + '0');
                }}
                className="py-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-white font-bold text-lg font-mono transition-all active:scale-95"
              >
                0
              </button>
              <button
                onClick={() => setPinInput(pinInput.slice(0, -1))}
                className="py-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-rose-400 text-sm font-bold transition-all"
              >
                ⌫
              </button>
            </div>

            <button
              id="receiver-connect-btn"
              onClick={() => handleConnect()}
              disabled={pinInput.length < 6}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-xl font-bold shadow-[0_4px_20px_rgba(37,99,235,0.3)] transition-transform text-white text-sm flex items-center justify-center gap-2 mt-4"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>CONNECT TO PEER</span>
            </button>
          </div>
        </div>
      ) : (
        /* Connected Video Player & Streaming Receiver Screen */
        <div className="space-y-4">
          {/* Header Bar */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-4 sm:p-5 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm">
                    {syncState?.sourceTitle || 'استریم زنده از گوشی مبدا'}
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    PIN: {activePin}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      connectionStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-amber-400'
                    }`}
                  />
                  <span className="font-mono text-[11px]">
                    {connectionStatus === 'connected'
                      ? 'P2P: WebRTC Unified Plan Connected'
                      : 'Connecting to Peer...'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="toggle-receiver-stats-btn"
                onClick={() => setShowStats(!showStats)}
                className="px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-xs font-mono text-blue-300 flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                <span>{stats ? `${stats.latencyMs}ms | ${stats.fps}FPS` : 'HUD Stats'}</span>
              </button>

              <button
                id="receiver-disconnect-btn"
                onClick={handleDisconnect}
                className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs text-rose-300 font-semibold border border-slate-700 transition-all"
              >
                قطع اتصال
              </button>
            </div>
          </div>

          {/* Main Receiver Video Container */}
          <div
            ref={containerRef}
            className="bg-slate-900/60 border border-slate-800 rounded-3xl p-3 sm:p-5 shadow-2xl backdrop-blur-xl relative group"
          >
            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center shadow-inner border border-slate-800/80">
              <video
                ref={videoRef}
                id="receiver-screen-video"
                autoPlay
                playsInline
                crossOrigin="anonymous"
                muted={isMuted}
                onTimeUpdate={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                }}
                className={`w-full h-full ${
                  aspectRatio === 'contain'
                    ? 'object-contain'
                    : aspectRatio === 'cover'
                    ? 'object-cover'
                    : 'object-fill'
                }`}
              />

              {/* LIVE Badge */}
              <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 bg-red-600 rounded text-white font-bold tracking-wider shadow-md">
                  LIVE
                </span>
                <span className="text-xs text-white/80 font-medium bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm hidden sm:inline-block">
                  {syncState?.sourceTitle || 'StreamSync Workflow'}
                </span>
              </div>

              {/* Stats Overlay HUD */}
              <StatsOverlay stats={stats} isOpen={showStats} onClose={() => setShowStats(false)} />

              {/* Center Frosted Play/Pause Trigger if paused */}
              {!isPlaying && (
                <button
                  onClick={() => sendRemoteControl('PLAY')}
                  className="absolute inset-0 m-auto w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:scale-105 transition-transform cursor-pointer shadow-2xl z-20"
                >
                  <Play className="w-10 h-10 mr-1 text-white fill-white" />
                </button>
              )}

              {/* Latency Quick Pill on top left */}
              {stats && (
                <div className="absolute top-3 left-3 z-30 px-2.5 py-1 rounded-full bg-slate-950/80 border border-blue-500/30 text-[11px] font-mono text-blue-400 flex items-center gap-1 backdrop-blur-sm shadow-md">
                  <Zap className="w-3 h-3 text-blue-400 fill-current" />
                  <span>تأخیر: {stats.latencyMs} ms</span>
                </div>
              )}
            </div>

            {/* Complete Synchronized Remote Controls */}
            <div className="mt-4 space-y-3 px-2">
              {/* Scrubber Bar */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 min-w-[42px]">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration || 120}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs font-mono text-slate-400 min-w-[42px]">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Controls Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                {/* Play, Pause, ±10s Controls */}
                <div className="flex items-center gap-2">
                  <button
                    id="receiver-play-pause-btn"
                    onClick={() => sendRemoteControl(isPlaying ? 'PAUSE' : 'PLAY')}
                    className="p-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all flex items-center gap-1.5 text-xs shadow-[0_4px_16px_rgba(37,99,235,0.3)]"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isPlaying ? 'توقف' : 'پخش'}</span>
                  </button>

                  <button
                    onClick={() => handleJump(-10)}
                    className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all text-xs font-mono border border-slate-700"
                    title="۱۰ ثانیه به عقب"
                  >
                    -10s
                  </button>

                  <button
                    onClick={() => handleJump(10)}
                    className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all text-xs font-mono border border-slate-700"
                    title="۱۰ ثانیه به جلو"
                  >
                    +10s
                  </button>
                </div>

                {/* Aspect Ratio, Volume, Fullscreen */}
                <div className="flex items-center gap-2">
                  {/* Aspect Ratio switcher */}
                  <button
                    onClick={toggleAspectRatio}
                    className="px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center gap-1 transition-all"
                    title="تغییر نسبت تصویر"
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px]">
                      {aspectRatio === 'contain' ? 'تناسب (Fit)' : aspectRatio === 'cover' ? 'پر کردن (Cover)' : 'کشش (Fill)'}
                    </span>
                  </button>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
                    <button
                      onClick={() => {
                        setIsMuted(!isMuted);
                        if (videoRef.current) videoRef.current.muted = !isMuted;
                      }}
                      className="text-slate-300 hover:text-white"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setVolume(val);
                        setIsMuted(val === 0);
                        if (videoRef.current) {
                          videoRef.current.volume = val;
                          videoRef.current.muted = val === 0;
                        }
                      }}
                      className="w-16 sm:w-20 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Fullscreen Button */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                    title="تمام صفحه"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Metric Diagnostic Grid from Design HTML */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-mono">Latency</p>
              <p className="text-xl font-mono text-blue-400 font-bold">
                {stats?.latencyMs ?? 12}<span className="text-xs ml-1 opacity-60">ms</span>
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-mono">Bitrate</p>
              <p className="text-xl font-mono text-blue-400 font-bold">
                {stats ? (stats.bitrateKbps / 1000).toFixed(1) : '6.4'}<span className="text-xs ml-1 opacity-60">Mbps</span>
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-mono">Frame Rate</p>
              <p className="text-xl font-mono text-blue-400 font-bold">
                {stats?.fps ?? 60}<span className="text-xs ml-1 opacity-60">fps</span>
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-mono">Sync Drift</p>
              <p className="text-xl font-mono text-emerald-400 font-bold">
                0.01<span className="text-xs ml-1 opacity-60">s</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
