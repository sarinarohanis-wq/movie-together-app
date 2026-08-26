import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SAMPLE_VIDEOS, QUALITY_PRESETS } from '../utils/sampleVideos';
import { SampleVideo, QualityPreset, StreamStats, VideoSourceType } from '../types';
import { WebRTCClient, ConnectionStatus } from '../utils/webrtcClient';
import { StatsOverlay } from './StatsOverlay';
import {
  Copy,
  Check,
  QrCode,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  Activity,
  Smartphone,
  Video,
  Monitor,
  Camera,
  Share2,
  Radio,
  Sparkles,
  Info,
  ExternalLink
} from 'lucide-react';

interface SenderViewProps {
  initialPin?: string;
  onOpenReceiver?: (pin: string) => void;
}

export const SenderView: React.FC<SenderViewProps> = ({ initialPin, onOpenReceiver }) => {
  const [pin, setPin] = useState<string>(initialPin || Math.floor(100000 + Math.random() * 900000).toString());
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedSourceType, setSelectedSourceType] = useState<VideoSourceType>('sample');
  const [selectedSample, setSelectedSample] = useState<SampleVideo>(SAMPLE_VIDEOS[0]);
  const [customFileUrl, setCustomFileUrl] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState<string>('');
  const [selectedQuality, setSelectedQuality] = useState<QualityPreset>(QUALITY_PRESETS[0]);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [peerName, setPeerName] = useState<string | null>(null);
  const [lastRemoteAction, setLastRemoteAction] = useState<string | null>(null);
  const [stats, setStats] = useState<StreamStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(120);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webrtcClientRef = useRef<WebRTCClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSyncingFromRemoteRef = useRef(false);

  // Direct Pairing URL
  const pairingUrl = `${window.location.origin}/?role=receiver&pin=${pin}`;

  // Initialize WebRTC Sender
  useEffect(() => {
    const client = new WebRTCClient('sender', pin, {
      onConnectionStatusChange: (status) => {
        setConnectionStatus(status);
        if (status === 'connected') {
          // Send initial sync state
          setTimeout(() => {
            if (videoRef.current) {
              client.sendSyncState({
                isPlaying: !videoRef.current.paused,
                currentTime: videoRef.current.currentTime,
                duration: videoRef.current.duration || 120,
                playbackRate: videoRef.current.playbackRate || 1,
                timestamp: Date.now(),
                sourceTitle: selectedSourceType === 'file' ? customFileName : selectedSample.titleFa
              });
            }
          }, 500);
        }
      },
      onPeerJoined: (role) => {
        setPeerName('گوشی مقصد (Receiver)');
      },
      onPeerDisconnected: () => {
        setPeerName(null);
      },
      onControlCommandReceived: (command) => {
        handleRemoteControl(command);
      },
      onStatsUpdated: (newStats) => {
        setStats(newStats);
      },
      onError: (err) => {
        console.warn('Sender WebRTC error:', err);
      }
    });

    webrtcClientRef.current = client;
    client.connect();

    return () => {
      client.destroy();
    };
  }, [pin]);

  // Handle remote controls sent from Receiver phone
  const handleRemoteControl = (command: { action: string; position: number; isPlaying: boolean }) => {
    if (!videoRef.current) return;
    isSyncingFromRemoteRef.current = true;
    setLastRemoteAction(`فرمان از مقصد: ${command.action} در ثانیه ${Math.round(command.position)}`);

    setTimeout(() => {
      setLastRemoteAction(null);
    }, 4000);

    switch (command.action) {
      case 'PLAY':
        videoRef.current.currentTime = command.position;
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
        break;
      case 'PAUSE':
        videoRef.current.currentTime = command.position;
        videoRef.current.pause();
        setIsPlaying(false);
        break;
      case 'SEEK':
        videoRef.current.currentTime = command.position;
        setCurrentTime(command.position);
        break;
    }

    setTimeout(() => {
      isSyncingFromRemoteRef.current = false;
    }, 200);
  };

  // Capture stream from video element or camera/screen
  const setupMediaStream = async () => {
    if (selectedSourceType === 'camera') {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: true
        });
        streamRef.current = camStream;
        if (videoRef.current) {
          videoRef.current.srcObject = camStream;
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
        webrtcClientRef.current?.setLocalStream(camStream);
        return;
      } catch (err) {
        console.error('Camera access error:', err);
      }
    }

    if (selectedSourceType === 'screen') {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 60 } },
          audio: true
        });
        streamRef.current = screenStream;
        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
        webrtcClientRef.current?.setLocalStream(screenStream);
        return;
      } catch (err) {
        console.error('Screen capture error:', err);
      }
    }

    // Video File or Sample Video: use captureStream
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      if (selectedSourceType === 'file' && customFileUrl) {
        videoRef.current.src = customFileUrl;
      } else {
        videoRef.current.src = selectedSample.url;
      }

      videoRef.current.onloadedmetadata = () => {
        if (!videoRef.current) return;
        setDuration(videoRef.current.duration || 120);

        try {
          // Capture stream from HTML5 Video
          let captured: MediaStream | null = null;
          if ('captureStream' in videoRef.current) {
            captured = (videoRef.current as any).captureStream(60);
          } else if ('mozCaptureStream' in videoRef.current) {
            captured = (videoRef.current as any).mozCaptureStream(60);
          }

          if (captured) {
            streamRef.current = captured;
            webrtcClientRef.current?.setLocalStream(captured);
          }
        } catch (e) {
          console.warn('captureStream not directly allowed, using direct sync');
        }
      };
    }
  };

  useEffect(() => {
    setupMediaStream();
  }, [selectedSourceType, selectedSample, customFileUrl]);

  // Video playback listeners
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      broadcastSync('PAUSE');
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      broadcastSync('PLAY');
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      broadcastSync('SEEK', time);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || isSyncingFromRemoteRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const broadcastSync = (action: 'PLAY' | 'PAUSE' | 'SEEK', customPos?: number) => {
    if (isSyncingFromRemoteRef.current || !videoRef.current) return;
    const pos = customPos !== undefined ? customPos : videoRef.current.currentTime;
    webrtcClientRef.current?.sendSyncState({
      isPlaying: action === 'PLAY' || (action === 'SEEK' && isPlaying),
      currentTime: pos,
      duration: videoRef.current.duration || duration,
      playbackRate: 1,
      timestamp: Date.now(),
      sourceTitle: selectedSourceType === 'file' ? customFileName : selectedSample.titleFa
    });
  };

  // Copy PIN to clipboard
  const handleCopyPin = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Local File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomFileUrl(url);
      setCustomFileName(file.name);
      setSelectedSourceType('file');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
      {/* Top Banner: One-time Connection PIN */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 text-center lg:text-right">
            <h2 className="text-xs uppercase tracking-widest text-slate-500 font-mono">Source Mode</h2>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white">
              کد اتصال یکبارمصرف و امن
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              این کد ۶ رقمی را در گوشی دوم (مقصد) وارد کنید تا استریم مستقیم P2P با تأخیر نزدیک به صفر برقرار شود.
            </p>
          </div>

          {/* Large PIN Code Display */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/80 border border-blue-900/40 p-4 sm:p-5 rounded-2xl shadow-inner">
            <div className="text-center px-4">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Temporary Connection Code</span>
              <div className="text-3xl sm:text-4xl md:text-5xl font-mono font-bold tracking-[0.2em] text-blue-400 select-all">
                {pin.slice(0, 3)} <span className="text-slate-600">-</span> {pin.slice(3, 6)}
              </div>
            </div>

            <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
              <button
                id="copy-pin-btn"
                onClick={handleCopyPin}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 transition-all shadow-[0_4px_20px_rgba(37,99,235,0.3)]"
              >
                {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'کپی شد' : 'کپی کد'}</span>
              </button>

              <button
                id="show-qr-btn"
                onClick={() => setShowQrModal(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-all border border-slate-700"
              >
                <QrCode className="w-4 h-4 text-blue-400" />
                <span>نمایش QR کد</span>
              </button>
            </div>
          </div>
        </div>

        {/* Connection Status & Notification Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 uppercase text-[10px] tracking-wider font-mono">P2P Status:</span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold border ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : connectionStatus === 'connecting'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#22c55e]'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-slate-500'
                }`}
              />
              {connectionStatus === 'connected'
                ? `متصل به گوشی مقصد (${peerName || 'Receiver'})`
                : connectionStatus === 'connecting'
                ? 'در انتظار ورود کد در گوشی مقصد...'
                : 'آماده برقراری اتصال WebRTC'}
            </span>
          </div>

          {lastRemoteAction && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-semibold animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lastRemoteAction}</span>
            </div>
          )}

          {onOpenReceiver && (
            <button
              onClick={() => onOpenReceiver(pin)}
              className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-semibold text-xs transition-colors"
            >
              <span>باز کردن گوشی مقصد در همین مرورگر</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Video Source Selector & Player */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Video Player & Controls (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Video Player Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-3 sm:p-5 shadow-2xl backdrop-blur-xl relative group">
            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border border-slate-800/80">
              <video
                ref={videoRef}
                id="sender-master-video"
                crossOrigin="anonymous"
                playsInline
                muted={isMuted}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
              />

              {/* Floating Real-time HUD Trigger */}
              <button
                id="toggle-sender-stats-btn"
                onClick={() => setShowStats(!showStats)}
                className="absolute top-3 right-3 z-30 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-700 text-xs font-mono text-blue-300 backdrop-blur-sm flex items-center gap-1.5 transition-all shadow-lg"
              >
                <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                <span>{stats ? `${stats.latencyMs}ms | ${stats.fps}FPS` : 'HUD Stats'}</span>
              </button>

              {/* LIVE Badge */}
              <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 bg-red-600 rounded text-white font-bold tracking-wider shadow-md">
                  LIVE
                </span>
                <span className="text-xs text-white/80 font-medium bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm hidden sm:inline-block">
                  {selectedSourceType === 'file' ? customFileName : selectedSample.titleFa}
                </span>
              </div>

              {/* Stats Overlay */}
              <StatsOverlay
                stats={stats}
                isOpen={showStats}
                onClose={() => setShowStats(false)}
                isSender={true}
              />

              {/* Center Frosted Play/Pause Overlay Icon when paused */}
              {!isPlaying && (
                <button
                  onClick={handlePlayPause}
                  className="absolute inset-0 m-auto w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:scale-105 transition-transform cursor-pointer shadow-2xl z-20"
                >
                  <Play className="w-10 h-10 mr-1 text-white fill-white" />
                </button>
              )}
            </div>

            {/* Video Player Controls */}
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

              {/* Buttons Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    id="sender-play-pause-btn"
                    onClick={handlePlayPause}
                    className="p-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all flex items-center gap-1.5 text-xs shadow-[0_4px_16px_rgba(37,99,235,0.3)]"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isPlaying ? 'توقف' : 'پخش'}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        setCurrentTime(0);
                        broadcastSync('SEEK', 0);
                      }
                    }}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all text-xs flex items-center gap-1 border border-slate-700"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>از ابتدا</span>
                  </button>
                </div>

                {/* Volume & Quality quick info */}
                <div className="flex items-center gap-3">
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
                      className="w-16 sm:w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono border border-slate-700">
                    {selectedQuality.nameEn}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Metric Diagnostic Grid from Design HTML */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-mono">Latency</p>
              <p className="text-xl font-mono text-blue-400 font-bold">
                {stats?.latencyMs ?? 18}<span className="text-xs ml-1 opacity-60">ms</span>
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

        {/* Right Column: Source Picker & Quality Settings (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Source Type Selector */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-blue-400" />
              <span>انتخاب محتوای استریم</span>
            </h3>

            {/* Source Type Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedSourceType('sample')}
                className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  selectedSourceType === 'sample'
                    ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Sparkles className="w-5 h-5 text-blue-400" />
                <span>کلیپ‌های نمونه</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  selectedSourceType === 'file'
                    ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Upload className="w-5 h-5 text-blue-400" />
                <span>فایل از حافظه گوشی</span>
              </button>

              <button
                onClick={() => setSelectedSourceType('camera')}
                className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  selectedSourceType === 'camera'
                    ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Camera className="w-5 h-5 text-blue-400" />
                <span>دوربین زنده</span>
              </button>

              <button
                onClick={() => setSelectedSourceType('screen')}
                className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  selectedSourceType === 'screen'
                    ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Monitor className="w-5 h-5 text-blue-400" />
                <span>اشتراک صفحه نمایش</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Custom file name banner if chosen */}
            {selectedSourceType === 'file' && customFileName && (
              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 text-xs text-blue-200 flex items-center justify-between">
                <span className="truncate font-mono">{customFileName}</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-400 hover:underline font-bold text-[11px]"
                >
                  تغییر
                </button>
              </div>
            )}

            {/* Sample Video Clips List */}
            {selectedSourceType === 'sample' && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {SAMPLE_VIDEOS.map((vid) => (
                  <div
                    key={vid.id}
                    onClick={() => setSelectedSample(vid)}
                    className={`p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                      selectedSample.id === vid.id
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <img
                      src={vid.thumbnail}
                      alt={vid.title}
                      className="w-12 h-9 rounded-lg object-cover bg-slate-800"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold truncate">{vid.titleFa}</h4>
                      <p className="text-[10px] text-slate-400 truncate">{vid.descriptionFa}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adaptive Bitrate & Quality Preset Selector */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <span>کنترل پهنای باند (Bitrate)</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                WebRTC UDP
              </span>
            </div>

            <div className="space-y-1.5">
              {QUALITY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setSelectedQuality(preset);
                    webrtcClientRef.current?.setBitrateCap(preset.maxBitrateKbps);
                  }}
                  className={`w-full text-right p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between ${
                    selectedQuality.id === preset.id
                      ? 'bg-blue-600/20 border-blue-500 text-white font-bold'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40'
                  }`}
                >
                  <span>{preset.nameFa}</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {preset.maxBitrateKbps > 1000
                      ? `${(preset.maxBitrateKbps / 1000).toFixed(1)} Mbps`
                      : `${preset.maxBitrateKbps}k`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal for Scanning from 2nd Smartphone */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-blue-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-white">اسکن کد با دوربین گوشی مقصد</h3>
            <p className="text-xs text-slate-300">
              دوربین گوشی دوم را روی این تصویر بگیرید تا مستقیماً به استریم متصل شوید.
            </p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-lg mx-auto">
              <QRCodeSVG value={pairingUrl} size={200} level="M" />
            </div>

            <div className="text-2xl font-black font-mono tracking-[0.2em] text-blue-400">
              {pin}
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-slate-700"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
