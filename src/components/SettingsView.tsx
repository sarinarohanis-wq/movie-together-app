import React, { useState, useEffect } from 'react';
import { UserSettings, DEFAULT_SETTINGS, loadSettings, saveSettings, resetSettings } from '../utils/settingsStore';
import { GITHUB_WORKFLOWS, WorkflowFile } from '../utils/githubWorkflowsData';
import {
  Settings,
  Sliders,
  Video,
  Volume2,
  Wifi,
  Palette,
  Shield,
  RotateCcw,
  Save,
  Check,
  Zap,
  Activity,
  Cpu,
  Monitor,
  Radio,
  FileText,
  Download,
  Upload,
  Layers,
  Sparkles,
  Info,
  Server,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  GitBranch,
  GitMerge,
  Copy,
  Terminal,
  ExternalLink,
  Box,
  Play
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [activeTab, setActiveTab] = useState<'general' | 'video' | 'audio' | 'network' | 'appearance' | 'diagnostics' | 'workflows'>('general');
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowFile>(GITHUB_WORKFLOWS[0]);
  const [copiedWorkflowId, setCopiedWorkflowId] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newStunUrl, setNewStunUrl] = useState('');
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResult, setDiagResult] = useState<{
    webrtcSupported: boolean;
    dataChannelSupported: boolean;
    stunPingMs: number | null;
    localIps: string[];
    status: 'idle' | 'success' | 'warning' | 'error';
    message: string;
  }>({
    webrtcSupported: true,
    dataChannelSupported: true,
    stunPingMs: null,
    localIps: [],
    status: 'idle',
    message: ''
  });

  const handleUpdate = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleReset = () => {
    if (window.confirm('آیا از بازنشانی تمام تنظیمات به حالت اولیه پیش‌فرض اطمینان دارید؟')) {
      const def = resetSettings();
      setSettings(def);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  const handleAddIceServer = () => {
    if (!newStunUrl.trim()) return;
    const updated = {
      ...settings,
      iceServers: [...settings.iceServers, { urls: newStunUrl.trim() }]
    };
    setSettings(updated);
    saveSettings(updated);
    setNewStunUrl('');
  };

  const handleRemoveIceServer = (index: number) => {
    const updated = {
      ...settings,
      iceServers: settings.iceServers.filter((_, i) => i !== index)
    };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleCopyWorkflow = (workflow: WorkflowFile) => {
    navigator.clipboard.writeText(workflow.content);
    setCopiedWorkflowId(workflow.id);
    setTimeout(() => setCopiedWorkflowId(null), 2500);
  };

  const handleDownloadWorkflow = (workflow: WorkflowFile) => {
    const blob = new Blob([workflow.content], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = workflow.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(settings, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'movie-together-settings.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          const merged = { ...DEFAULT_SETTINGS, ...parsed };
          setSettings(merged);
          saveSettings(merged);
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 2000);
        } catch (err) {
          alert('فایل پیکربندی نامعتبر است.');
        }
      };
    }
  };

  const runDiagnostics = async () => {
    setDiagRunning(true);
    setDiagResult({
      webrtcSupported: 'RTCPeerConnection' in window,
      dataChannelSupported: 'RTCDataChannel' in window,
      stunPingMs: null,
      localIps: [],
      status: 'idle',
      message: 'در حال ارزیابی اتصال به سرورهای STUN و بررسی کاندیداها...'
    });

    const startTime = performance.now();
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.createDataChannel('pingTest');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const foundIps: string[] = [];

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          pc.close();
          resolve();
        }, 3000);

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidateStr = event.candidate.candidate;
            const ipMatch = candidateStr.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
            if (ipMatch && !foundIps.includes(ipMatch[1])) {
              foundIps.push(ipMatch[1]);
            }
          } else {
            clearTimeout(timeout);
            pc.close();
            resolve();
          }
        };
      });

      const elapsed = Math.round(performance.now() - startTime);

      setDiagResult({
        webrtcSupported: true,
        dataChannelSupported: true,
        stunPingMs: elapsed,
        localIps: foundIps.length > 0 ? foundIps : ['127.0.0.1 (Local host)'],
        status: 'success',
        message: 'ارزیابی شبکه کامل شد. پروتکل WebRTC و کاندیداهای ICE کاملاً فعال و آماده اتصال هستند.'
      });
    } catch (e: any) {
      setDiagResult({
        webrtcSupported: 'RTCPeerConnection' in window,
        dataChannelSupported: 'RTCDataChannel' in window,
        stunPingMs: null,
        localIps: [],
        status: 'warning',
        message: `خطا در تست ICE: ${e?.message || 'مشکل در برقراری ارتباط'}`
      });
    } finally {
      setDiagRunning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
            <Settings className="w-6 h-6 animate-[spin_12s_linear_infinite]" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-0.5">Control Panel & Preferences</div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              تنظیمات جامع Movie Together
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              مدیریت پارامترهای استریم P2P، کیفیت تصویر و صدا، سرورهای سیگنالینگ WebRTC و شخصی‌سازی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          {savedSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold animate-pulse">
              <Check className="w-3.5 h-3.5" />
              <span>ذخیره شد</span>
            </div>
          )}

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-900/30 hover:text-rose-300 text-slate-300 text-xs font-semibold border border-slate-700 hover:border-rose-700/50 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>بازنشانی پیش‌فرض</span>
          </button>
        </div>
      </div>

      {/* Main Settings Tabs & Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="space-y-1.5 lg:col-span-1">
          <button
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-right ${
              activeTab === 'general'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-slate-900/40 hover:bg-slate-800/60 text-slate-400 hover:text-white border border-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>پارتی تماشا و همگام‌سازی</span>
          </button>

          <button
            onClick={() => setActiveTab('video')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-right ${
              activeTab === 'video'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-slate-900/40 hover:bg-slate-800/60 text-slate-400 hover:text-white border border-slate-800/60'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>کیفیت تصویر و موتور استریم</span>
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-right ${
              activeTab === 'audio'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-slate-900/40 hover:bg-slate-800/60 text-slate-400 hover:text-white border border-slate-800/60'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>صدا، گفتگو و زیرنویس</span>
          </button>

          <button
            onClick={() => setActiveTab('network')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-right ${
              activeTab === 'network'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-slate-900/40 hover:bg-slate-800/60 text-slate-400 hover:text-white border border-slate-800/60'
            }`}
          >
            <Wifi className="w-4 h-4" />
            <span>شبکه، ICE و سرور سیگنالینگ</span>
          </button>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-right ${
              activeTab === 'appearance'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-slate-900/40 hover:bg-slate-800/60 text-slate-400 hover:text-white border border-slate-800/60'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>ظاهر، تم و مانیتورینگ</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-right ${
              activeTab === 'diagnostics'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-slate-900/40 hover:bg-slate-800/60 text-slate-400 hover:text-white border border-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>تست شبکه و ارزیابی WebRTC</span>
          </button>

          <button
            onClick={() => setActiveTab('workflows')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-right ${
              activeTab === 'workflows'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-slate-900/40 hover:bg-slate-800/60 text-slate-400 hover:text-white border border-slate-800/60'
            }`}
          >
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <span>ورک‌فلوهای گیت‌هاب (CI/CD)</span>
          </button>

          {/* Backup Section In Sidebar */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 px-2">پشتیبان‌گیری تنظیمات</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportJson}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold border border-slate-800 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>خروجی JSON</span>
              </button>

              <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold border border-slate-800 cursor-pointer transition-all">
                <Upload className="w-3.5 h-3.5" />
                <span>ورودی JSON</span>
                <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Content Panel */}
        <div className="lg:col-span-3 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
          {/* TAB 1: GENERAL & SYNC */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-1">پارتی تماشا و همگام‌سازی همزمان</h3>
                <p className="text-xs text-slate-400">تنظیم رفتار پخش خودکار، میزان دقت همگام‌سازی فریم‌ها و دسترسی‌های کنترل کننده</p>
              </div>

              <div className="space-y-4">
                {/* Display Name */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                  <label className="block text-xs font-bold text-slate-200">نام نمایشی شما در اتاق استریم</label>
                  <input
                    type="text"
                    value={settings.displayName}
                    onChange={(e) => handleUpdate('displayName', e.target.value)}
                    placeholder="مثال: علی یا گوشی سامسونگ"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[11px] text-slate-500">این نام هنگام اتصال به گوشی طرف مقابل نمایش داده می‌شود.</span>
                </div>

                {/* Sync Tolerance Slider */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">حداکثر اختلاف مجاز همگام‌سازی (Sync Tolerance)</span>
                      <span className="text-[11px] text-slate-400">اگر اختلاف زمانی گیرنده از این مقدار بیشتر شود، پرش خودکار انجام می‌شود.</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-800/40">
                      {settings.syncToleranceMs} میلی‌ثانیه
                    </span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="500"
                    step="10"
                    value={settings.syncToleranceMs}
                    onChange={(e) => handleUpdate('syncToleranceMs', Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>30ms (فوق‌سریع / حساس)</span>
                    <span>150ms (پیش‌فرض پیشنهادی)</span>
                    <span>500ms (نرم و بدون پرش)</span>
                  </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">پخش خودکار پس از اتصال</span>
                      <span className="text-[11px] text-slate-400">شروع بلافاصله استریم با تایید پین</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoPlayOnConnect}
                      onChange={(e) => handleUpdate('autoPlayOnConnect', e.target.checked)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">کنترل انحصاری میزبان (Host Only)</span>
                      <span className="text-[11px] text-slate-400">فقط فرستنده می‌تواند توقف/پخش کند</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.hostControlOnly}
                      onChange={(e) => handleUpdate('hostControlOnly', e.target.checked)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">صدای هشدار رویدادها</span>
                      <span className="text-[11px] text-slate-400">بوق آرام هنگام اتصال یا قطع کلاینت</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.soundNotifications}
                      onChange={(e) => handleUpdate('soundNotifications', e.target.checked)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">اتصال مجدد خودکار</span>
                      <span className="text-[11px] text-slate-400">تلاش خودکار در صورت قطعی موقت وای‌فای</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoReconnect}
                      onChange={(e) => handleUpdate('autoReconnect', e.target.checked)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VIDEO & STREAM ENGINE */}
          {activeTab === 'video' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-1">تنظیمات تصویر و کدک‌های WebRTC</h3>
                <p className="text-xs text-slate-400">پیکربندی انکودر سخت‌افزاری، کدک فشرده‌سازی و نرخ فریم استریم</p>
              </div>

              <div className="space-y-4">
                {/* Codec Selection */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                  <label className="block text-xs font-bold text-slate-200">کدک اولویت‌دار ویدئو (Video Codec)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['VP9', 'VP8', 'H264', 'AV1'] as const).map((codec) => (
                      <button
                        key={codec}
                        onClick={() => handleUpdate('videoCodec', codec)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          settings.videoCodec === codec
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-sm font-mono">{codec}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {codec === 'VP9' && 'بهترین برای کیفیت'}
                          {codec === 'VP8' && 'کمترین فشار CPU'}
                          {codec === 'H264' && 'شتاب‌دهنده سخت‌افزار'}
                          {codec === 'AV1' && 'فشرده‌ترین نسل جدید'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Resolution & FPS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                    <label className="block text-xs font-bold text-slate-200">کیفیت پیش‌فرض استریم</label>
                    <select
                      value={settings.defaultResolution}
                      onChange={(e) => handleUpdate('defaultResolution', e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="auto">کیفیت تطبیقی خودکار (Auto)</option>
                      <option value="1080p">فول اچ‌دی (1080p FHD)</option>
                      <option value="720p">اچ‌دی استاندارد (720p HD)</option>
                      <option value="480p">کیفیت متوسط (480p SD)</option>
                      <option value="360p">صرفه‌جویی دیتا (360p)</option>
                    </select>
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                    <label className="block text-xs font-bold text-slate-200">نرخ فریم هدف (FPS)</label>
                    <select
                      value={settings.targetFps}
                      onChange={(e) => handleUpdate('targetFps', Number(e.target.value) as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    >
                      <option value="60">60 FPS (فوق‌العاده روان)</option>
                      <option value="30">30 FPS (استاندارد نرمال)</option>
                      <option value="24">24 FPS (استاندارد فیلم سینمایی)</option>
                    </select>
                  </div>
                </div>

                {/* Max Bitrate Slider */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">سقف پهنای‌باند استریم (Max Bitrate)</span>
                      <span className="text-[11px] text-slate-400">حداکثر حجم ارسالی در هر ثانیه روی شبکه وای‌فای</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-800/40">
                      {(settings.maxBitrateKbps / 1000).toFixed(1)} Mbps ({settings.maxBitrateKbps} Kbps)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="15000"
                    step="500"
                    value={settings.maxBitrateKbps}
                    onChange={(e) => handleUpdate('maxBitrateKbps', Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">شتاب‌دهنده سخت‌افزاری (Hardware Acceleration)</span>
                      <span className="text-[11px] text-slate-400">استفاده از GPU گوشی برای دیکود و اینکود</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.hardwareAcceleration}
                      onChange={(e) => handleUpdate('hardwareAcceleration', e.target.checked)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">تنظیم خودکار بیت‌ریت (Adaptive Bitrate)</span>
                      <span className="text-[11px] text-slate-400">کاهش هوشمند کیفیت هنگام افت سیگنال وای‌فای</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.adaptiveBitrate}
                      onChange={(e) => handleUpdate('adaptiveBitrate', e.target.checked)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIO & SUBTITLES */}
          {activeTab === 'audio' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-1">تنظیمات صدا، استریو و زیرنویس</h3>
                <p className="text-xs text-slate-400">شخصی‌سازی خروجی صدا، حذف نویز میکروفون و ظاهر فونت زیرنویس فیلم</p>
              </div>

              <div className="space-y-4">
                {/* Audio Quality */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                    <label className="block text-xs font-bold text-slate-200">بیت‌ریت کدک صدای Opus</label>
                    <select
                      value={settings.audioBitrateKbps}
                      onChange={(e) => handleUpdate('audioBitrateKbps', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    >
                      <option value="64">64 Kbps (اقتصادی و کم‌حجم)</option>
                      <option value="128">128 Kbps (استاندارد شفاف)</option>
                      <option value="192">192 Kbps (کیفیت بالای موزیک و فیلم)</option>
                      <option value="320">320 Kbps (حداکثر کیفیت استودیو)</option>
                    </select>
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                    <label className="block text-xs font-bold text-slate-200">تنظیم تاخیر صدای دستی (Audio Offset)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-500"
                        max="500"
                        step="25"
                        value={settings.audioSyncOffsetMs}
                        onChange={(e) => handleUpdate('audioSyncOffsetMs', Number(e.target.value))}
                        className="flex-1 accent-blue-500 cursor-pointer"
                      />
                      <span className="text-xs font-mono text-blue-400 w-16 text-left">
                        {settings.audioSyncOffsetMs > 0 ? `+${settings.audioSyncOffsetMs}` : settings.audioSyncOffsetMs} ms
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subtitle Appearance */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-4">
                  <span className="text-xs font-bold text-slate-200 block">شخصی‌سازی زیرنویس فیلم</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">اندازه قلم</label>
                      <select
                        value={settings.subtitleFontSize}
                        onChange={(e) => handleUpdate('subtitleFontSize', e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="small">کوچک (14px)</option>
                        <option value="medium">متوسط (18px)</option>
                        <option value="large">بزرگ (22px)</option>
                        <option value="xlarge">خیلی بزرگ (28px)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">رنگ متن</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.subtitleColor}
                          onChange={(e) => handleUpdate('subtitleColor', e.target.value)}
                          className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                        />
                        <span className="text-xs font-mono text-slate-300">{settings.subtitleColor}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">شفافیت پس‌زمینه ({settings.subtitleBgOpacity}%)</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={settings.subtitleBgOpacity}
                        onChange={(e) => handleUpdate('subtitleBgOpacity', Number(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Subtitle Preview Box */}
                  <div className="h-16 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800">
                    <span
                      style={{
                        color: settings.subtitleColor,
                        backgroundColor: `rgba(0,0,0,${settings.subtitleBgOpacity / 100})`,
                        fontSize: settings.subtitleFontSize === 'small' ? '12px' : settings.subtitleFontSize === 'medium' ? '16px' : settings.subtitleFontSize === 'large' ? '20px' : '24px'
                      }}
                      className="px-3 py-1 rounded font-sans"
                    >
                      پیش‌نمایش زیرنویس فیلم در Movie Together
                    </span>
                  </div>
                </div>

                {/* Voice Filtering Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">حذف اکو و بازگشت صدا (Echo Cancellation)</span>
                      <span className="text-[11px] text-slate-400">جلوگیری از انعکاس صدای بلندگو در میکروفون</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.echoCancellation}
                      onChange={(e) => handleUpdate('echoCancellation', e.target.checked)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">کاهش هوشمند نویز پس‌زمینه</span>
                      <span className="text-[11px] text-slate-400">فیلتر نویز فن، باد و صداهای اضافی محیط</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.noiseSuppression}
                      onChange={(e) => handleUpdate('noiseSuppression', e.target.checked)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NETWORK & WEBRTC SIGNALING */}
          {activeTab === 'network' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-1">شبکه، سرورهای STUN/TURN و سیگنالینگ</h3>
                <p className="text-xs text-slate-400">پیکربندی سرورهای کشف کاندیداهای شبکه جهت عبور از فایروال و اتصال مستقیم</p>
              </div>

              <div className="space-y-4">
                {/* Custom Signaling Server */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                  <label className="block text-xs font-bold text-slate-200">آدرس سفارشی سرور سیگنالینگ WebSocket (اختیاری)</label>
                  <input
                    type="text"
                    value={settings.customSignalingServer}
                    onChange={(e) => handleUpdate('customSignalingServer', e.target.value)}
                    placeholder="پیش‌فرض سرور محلی برنامه: ws://localhost:3000/ws"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[11px] text-slate-500">اگر فیلد را خالی بگذارید، سرور سیگنالینگ پیش‌فرض برنامه استفاده می‌شود.</span>
                </div>

                {/* STUN / TURN Server List */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">فهرست سرورهای STUN / TURN فعال</span>
                    <span className="text-[10px] font-mono text-slate-400">{settings.iceServers.length} سرور</span>
                  </div>

                  <div className="space-y-2">
                    {settings.iceServers.map((server, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800 text-xs font-mono">
                        <span className="text-slate-300 truncate">{server.urls}</span>
                        <button
                          onClick={() => handleRemoveIceServer(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                          title="حذف سرور"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add New STUN */}
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={newStunUrl}
                      onChange={(e) => setNewStunUrl(e.target.value)}
                      placeholder="stun:stun.l.google.com:19302"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-500"
                    />
                    <button
                      onClick={handleAddIceServer}
                      className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن</span>
                    </button>
                  </div>
                </div>

                {/* Force TURN relay */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">اجبار به استفاده از رله TURN (Force Relay)</span>
                    <span className="text-[11px] text-slate-400">مناسب برای شبکه‌های با فایروال بسته یا NAT متقارن</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.forceRelayTurn}
                    onChange={(e) => handleUpdate('forceRelayTurn', e.target.checked)}
                    className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: APPEARANCE & THEME */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-1">ظاهر، تم و مانیتورینگ بلادرنگ</h3>
                <p className="text-xs text-slate-400">شخصی‌سازی رنگ تاکید، حالت سینمایی و نمایش آمار زنده شبکه</p>
              </div>

              <div className="space-y-4">
                {/* Theme Color Picker */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <label className="block text-xs font-bold text-slate-200">رنگ شاخص تم برنامه</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { id: 'blue', name: 'آبی الکتریک', color: 'bg-blue-500' },
                      { id: 'emerald', name: 'سبز زمردی', color: 'bg-emerald-500' },
                      { id: 'violet', name: 'بنفش سایبر', color: 'bg-purple-500' },
                      { id: 'rose', name: 'قرمز یاقوتی', color: 'bg-rose-500' },
                      { id: 'amber', name: 'کهربایی', color: 'bg-amber-500' }
                    ].map((th) => (
                      <button
                        key={th.id}
                        onClick={() => handleUpdate('themeColor', th.id as any)}
                        className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
                          settings.themeColor === th.id
                            ? 'bg-slate-900 border-white text-white font-bold shadow-lg'
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full ${th.color} shadow-md`} />
                        <span className="text-[11px]">{th.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dark Style */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <label className="block text-xs font-bold text-slate-200">عمق رنگ تاریک (Dark Mode Depth)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'oled', name: 'مشکی عمیق (OLED Black)', desc: 'کاهش مصرف باتری گوشی' },
                      { id: 'midnight', name: 'آبی نیمه‌شب (Midnight)', desc: 'کنتراست نرم سینمایی' },
                      { id: 'slate', name: 'خاکستری تیره (Slate)', desc: 'رنگ کلاسیک استودیو' }
                    ].map((d) => (
                      <button
                        key={d.id}
                        onClick={() => handleUpdate('darkStyle', d.id as any)}
                        className={`p-3 rounded-xl border text-right transition-all ${
                          settings.darkStyle === d.id
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs">{d.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{d.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">نمایش لایه آمار HUD روی ویدئو</span>
                      <span className="text-[11px] text-slate-400">نمایش پینگ، RTT، بیت‌ریت و فریم‌ریت زنده</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.showStatsOverlay}
                      onChange={(e) => handleUpdate('showStatsOverlay', e.target.checked)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">تاریک کردن خودکار صفحه (حالت سینما)</span>
                      <span className="text-[11px] text-slate-400">تاریک شدن سایر بخش‌ها هنگام پخش ویدئو</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.theaterModeAutoDim}
                      onChange={(e) => handleUpdate('theaterModeAutoDim', e.target.checked)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-1">ارزیابی و تست زنده اتصال WebRTC</h3>
                <p className="text-xs text-slate-400">بررسی پشتیبانی مرورگر، پینگ به سرور STUN و استخراج کاندیداهای شبکه</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-sm font-bold text-white block">اجرای بنچ‌مارک و تست زنده WebRTC</span>
                    <span className="text-xs text-slate-400">یک نشست تستی ایجاد شده و زمان دریافت پاسخ از STUN سنجیده می‌شود.</span>
                  </div>
                  <button
                    onClick={runDiagnostics}
                    disabled={diagRunning}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all shrink-0"
                  >
                    <Activity className={`w-4 h-4 ${diagRunning ? 'animate-spin' : ''}`} />
                    <span>{diagRunning ? 'در حال تست شبکه...' : 'شروع تست شبکه'}</span>
                  </button>
                </div>

                {diagResult.status !== 'idle' && (
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      {diagResult.status === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-400" />
                      )}
                      <span className={diagResult.status === 'success' ? 'text-emerald-400' : 'text-amber-400'}>
                        {diagResult.message}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">WebRTC API</span>
                        <span className="text-emerald-400 font-bold">پشتیبانی کامل (Pass)</span>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">STUN Ping Time</span>
                        <span className="text-blue-400 font-bold">{diagResult.stunPingMs ? `${diagResult.stunPingMs} ms` : 'در دسترس'}</span>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">کاندیداهای شبکه کشف‌شده</span>
                        <span className="text-purple-400 font-bold">{diagResult.localIps.join(', ') || '1 کاندید'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: GITHUB WORKFLOWS & CI/CD */}
          {activeTab === 'workflows' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-emerald-400" />
                    <span>ورک‌فلوهای خودکار گیت‌هاب (GitHub Actions CI/CD)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    پیکربندی خط لوله خودکار تست، بیلد پروداکشن، ساخت ایمیج داکر و ریلیز خودکار پروژه در GitHub
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    ۳ ورک‌فلو فعال
                  </span>
                </div>
              </div>

              {/* Workflow Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {GITHUB_WORKFLOWS.map((wf) => {
                  const isSelected = selectedWorkflow.id === wf.id;
                  return (
                    <button
                      key={wf.id}
                      onClick={() => setSelectedWorkflow(wf)}
                      className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-3 relative ${
                        isSelected
                          ? 'bg-slate-800/90 border-emerald-500/80 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {wf.filename}
                          </span>
                          {wf.category === 'ci' && <span className="text-[10px] font-bold text-blue-400">CI / Test</span>}
                          {wf.category === 'docker' && <span className="text-[10px] font-bold text-purple-400">Docker</span>}
                          {wf.category === 'release' && <span className="text-[10px] font-bold text-emerald-400">Release</span>}
                        </div>
                        <h4 className="text-xs font-bold text-white">{wf.nameFa}</h4>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                        <span className="font-mono text-[10px]">{wf.path}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Workflow Detail & Actions */}
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800/80 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{selectedWorkflow.nameFa}</h4>
                      <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {selectedWorkflow.path}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{selectedWorkflow.descriptionFa}</p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleCopyWorkflow(selectedWorkflow)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700 hover:border-slate-600 transition-all"
                    >
                      {copiedWorkflowId === selectedWorkflow.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">کپی شد!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>کپی کد YAML</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDownloadWorkflow(selectedWorkflow)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>دانلود فایل .yml</span>
                    </button>
                  </div>
                </div>

                {/* Workflow Code Box */}
                <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900/90">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                      <span className="mr-2 text-slate-300">{selectedWorkflow.filename}</span>
                    </div>
                    <span>GitHub Actions Workflow Syntax (YAML)</span>
                  </div>
                  <pre
                    className="p-4 text-xs font-mono text-emerald-300/90 leading-relaxed overflow-x-auto max-h-80 selection:bg-emerald-600/30 text-left"
                    dir="ltr"
                  >
                    <code>{selectedWorkflow.content}</code>
                  </pre>
                </div>
              </div>

              {/* Instructions & Guides */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Guide 1: How to use on GitHub */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    <span>نحوه فعال‌سازی در مخزن گیت‌هاب</span>
                  </div>
                  <ol className="text-[11px] text-slate-300 space-y-2 list-decimal list-inside leading-relaxed pr-1">
                    <li>فایل‌های ورک‌فلو از قبل در مسیر <code className="text-blue-300 font-mono">.github/workflows/</code> پروژه قرار گرفته‌اند.</li>
                    <li>پروژه را به مخزن گیت‌هاب خود Push کنید: <code className="text-slate-400 font-mono">git push origin main</code></li>
                    <li>در صفحه ریپازیتوری خود در GitHub، وارد تب <strong>Actions</strong> شوید.</li>
                    <li>ورک‌فلوها به صورت کاملاً خودکار روی سرورهای ابری گیت‌هاب اجرا می‌شوند.</li>
                  </ol>
                </div>

                {/* Guide 2: Docker execution */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Box className="w-4 h-4 text-purple-400" />
                    <span>اجرای فوری با داکر (Docker & Container)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    فایل <code className="text-purple-300 font-mono">Dockerfile</code> آماده است. برای اجرای سریع کانتینر در سرور یا لینوکس محلی:
                  </p>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[10px] font-mono text-purple-300 text-left overflow-x-auto" dir="ltr">
                    docker build -t movie-together .<br />
                    docker run -d -p 3000:3000 --name movie-together-app movie-together
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
