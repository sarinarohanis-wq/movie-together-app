import React, { useState } from 'react';
import { SenderView } from './SenderView';
import { ReceiverView } from './ReceiverView';
import { Radio, Smartphone, Zap, ArrowLeftRight } from 'lucide-react';

export const DualSimulatorView: React.FC = () => {
  const [simulatorPin] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6" dir="rtl">
      {/* Simulator Intro Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-0.5">Dual-Device Realtime Testbed</div>
            <h2 className="text-base font-bold text-white">
              شبیه‌ساز بلادرنگ دو گوشی (تست همزمان مبدا و مقصد)
            </h2>
            <p className="text-xs text-slate-400">
              در این بخش هر دو گوشی به صورت کنار هم با پروتکل WebRTC و کانال داده (DataChannel) به صورت زنده به یکدیگر متصل شده‌اند.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-blue-900/50 text-blue-400 shadow-inner relative z-10">
          <Zap className="w-4 h-4 text-blue-400 fill-current" />
          <span>Active PIN: <strong className="text-white tracking-widest">{simulatorPin}</strong></span>
        </div>
      </div>

      {/* Side-by-Side Dual Phone Mockup Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Phone 1: Sender */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
              <Radio className="w-4 h-4" />
              <span>صفحه گوشی اول: مبدا (فرستنده)</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Source Node (Broadcaster)</span>
          </div>

          <div className="border border-slate-800 rounded-3xl overflow-hidden shadow-2xl bg-slate-950/90 backdrop-blur-xl">
            <SenderView initialPin={simulatorPin} />
          </div>
        </div>

        {/* Phone 2: Receiver */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Smartphone className="w-4 h-4" />
              <span>صفحه گوشی دوم: مقصد (گیرنده)</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Destination Node (Player)</span>
          </div>

          <div className="border border-slate-800 rounded-3xl overflow-hidden shadow-2xl bg-slate-950/90 backdrop-blur-xl">
            <ReceiverView initialPin={simulatorPin} autoConnect={true} />
          </div>
        </div>
      </div>
    </div>
  );
};

