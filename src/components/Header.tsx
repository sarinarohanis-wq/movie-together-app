import React from 'react';
import { AppMode } from '../types';
import { Smartphone, Radio, PlayCircle, Settings, Wifi } from 'lucide-react';

interface HeaderProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  activePin?: string;
  isConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onModeChange,
  activePin,
  isConnected = false,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-4" dir="rtl">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Status */}
        <div className="flex items-center justify-between w-full md:w-auto gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] text-white shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Movie Together
                </h1>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  WebRTC P2P
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                استریم کم‌تأخیر ویدئو بین دو گوشی با همگام‌سازی بلادرنگ
              </p>
            </div>
          </div>

          {/* Connection and Network Status */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'}`} />
              <span className="text-xs font-mono text-slate-300">
                {isConnected ? 'P2P: CONNECTED' : 'P2P: READY'}
              </span>
            </div>

            <div className="text-slate-400 text-xs hidden lg:block font-mono">
              WLAN: <span className="text-white">Local_Direct</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 p-1.5 bg-slate-900/60 border border-slate-800 rounded-2xl w-full md:w-auto overflow-x-auto justify-start sm:justify-center backdrop-blur-xl">
          <button
            id="tab-sender"
            onClick={() => onModeChange('sender')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              currentMode === 'sender'
                ? 'bg-blue-600 text-white shadow-[0_4px_16px_rgba(37,99,235,0.35)]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>گوشی مبدا (Source)</span>
          </button>

          <button
            id="tab-receiver"
            onClick={() => onModeChange('receiver')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              currentMode === 'receiver'
                ? 'bg-blue-600 text-white shadow-[0_4px_16px_rgba(37,99,235,0.35)]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>گوشی مقصد (Receiver)</span>
          </button>

          <button
            id="tab-dual"
            onClick={() => onModeChange('dual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              currentMode === 'dual'
                ? 'bg-indigo-600 text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>شبیه‌ساز دو گوشی (Dual)</span>
          </button>

          <button
            id="tab-settings"
            onClick={() => onModeChange('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              currentMode === 'settings'
                ? 'bg-slate-800 text-blue-400 border border-blue-500/40 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>تنظیمات</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
