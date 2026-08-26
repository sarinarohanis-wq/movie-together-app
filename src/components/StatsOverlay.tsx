import React from 'react';
import { StreamStats } from '../types';
import { Activity, Wifi, Zap, Clock, ShieldCheck, Video } from 'lucide-react';

interface StatsOverlayProps {
  stats: StreamStats | null;
  isOpen: boolean;
  onClose: () => void;
  isSender?: boolean;
}

export const StatsOverlay: React.FC<StatsOverlayProps> = ({ stats, isOpen, onClose }) => {
  if (!isOpen || !stats) return null;

  const getLatencyColor = (ms: number) => {
    if (ms < 35) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (ms < 75) return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
    if (ms < 150) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  return (
    <div
      id="stats-overlay-container"
      className="absolute top-4 left-4 z-40 bg-slate-950/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl text-xs font-mono text-slate-200 max-w-xs w-full transition-all animate-in fade-in zoom-in-95 duration-150"
      dir="rtl"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
          <span className="font-semibold text-slate-100">WebRTC HUD Diagnostics</span>
        </div>
        <button
          id="close-stats-btn"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm font-sans"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2.5">
        {/* Latency Metric */}
        <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>RTT Latency:</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full border font-bold ${getLatencyColor(stats.latencyMs)}`}>
            {stats.latencyMs} ms {stats.latencyMs < 30 ? '⚡ Ultra' : ''}
          </span>
        </div>

        {/* Bitrate & FPS */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span>Bitrate</span>
            </div>
            <div className="text-sm font-bold text-blue-400">
              {stats.bitrateKbps > 1000 ? `${(stats.bitrateKbps / 1000).toFixed(1)} Mbps` : `${stats.bitrateKbps} kbps`}
            </div>
          </div>

          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Video className="w-3.5 h-3.5 text-emerald-400" />
              <span>FPS</span>
            </div>
            <div className="text-sm font-bold text-emerald-400">{stats.fps} fps</div>
          </div>
        </div>

        {/* Resolution & Packet Loss */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-slate-400 mb-1">Resolution</div>
            <div className="font-bold text-slate-200">{stats.resolution || '1280x720'}</div>
          </div>

          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-slate-400 mb-1">Packet Loss</div>
            <div className={`font-bold ${stats.packetLossPercent === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.packetLossPercent}%
            </div>
          </div>
        </div>

        {/* ICE & Transport Details */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-blue-400" />
            <span>Transport:</span>
          </div>
          <span className="text-blue-400 font-semibold">{stats.iceType}</span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-indigo-400" />
            <span>Security:</span>
          </div>
          <span className="text-indigo-300">DTLS / SRTP (UDP)</span>
        </div>
      </div>
    </div>
  );
};

