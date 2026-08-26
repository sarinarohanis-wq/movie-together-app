import React, { useState, useEffect } from 'react';
import { AppMode } from './types';
import { Header } from './components/Header';
import { SenderView } from './components/SenderView';
import { ReceiverView } from './components/ReceiverView';
import { DualSimulatorView } from './components/DualSimulatorView';
import { SettingsView } from './components/SettingsView';
import { Radio, Smartphone, Zap, Shield, Cpu, ExternalLink, Activity } from 'lucide-react';

export default function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>('sender');
  const [initialPin, setInitialPin] = useState<string>('');
  const [autoConnectReceiver, setAutoConnectReceiver] = useState<boolean>(false);

  // Check URL query parameters for direct receiver pairing from QR code
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const roleParam = urlParams.get('role');
      const pinParam = urlParams.get('pin');

      if (pinParam) {
        setInitialPin(pinParam);
      }

      if (roleParam === 'receiver') {
        setCurrentMode('receiver');
        if (pinParam) {
          setAutoConnectReceiver(true);
        }
      } else if (roleParam === 'dual') {
        setCurrentMode('dual');
      } else if (roleParam === 'settings') {
        setCurrentMode('settings');
      }
    } catch (e) {
      console.warn('URL params parsing error:', e);
    }
  }, []);

  const handleOpenReceiverWithPin = (pin: string) => {
    setInitialPin(pin);
    setAutoConnectReceiver(true);
    setCurrentMode('receiver');
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col selection:bg-blue-600 selection:text-white relative overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Navigation */}
      <Header
        currentMode={currentMode}
        onModeChange={(mode) => {
          setCurrentMode(mode);
          setAutoConnectReceiver(false);
        }}
      />

      {/* Main View Area */}
      <main className="flex-1 py-4 sm:py-6 relative z-10">
        {currentMode === 'sender' && (
          <SenderView
            initialPin={initialPin}
            onOpenReceiver={handleOpenReceiverWithPin}
          />
        )}

        {currentMode === 'receiver' && (
          <ReceiverView
            initialPin={initialPin}
            autoConnect={autoConnectReceiver}
          />
        )}

        {currentMode === 'dual' && <DualSimulatorView />}

        {currentMode === 'settings' && <SettingsView />}
      </main>

      {/* Footer Info & Tech Specs */}
      <footer className="bg-slate-900/60 backdrop-blur-xl border-t border-slate-800/80 py-4 px-4 text-xs text-slate-400 relative z-10" dir="rtl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Radio className="w-3.5 h-3.5 text-blue-400" />
              <span>پروتکل: WebRTC Unified Plan (UDP)</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>تأخیر هدف: کمتر از ۳۰ میلی‌ثانیه</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Shield className="w-3.5 h-3.5 text-blue-500" />
              <span>رمزنگاری: DTLS-SRTP امن و محلی</span>
            </span>
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            Movie Together • WebRTC P2P Video Engine
          </div>
        </div>
      </footer>
    </div>
  );
}
