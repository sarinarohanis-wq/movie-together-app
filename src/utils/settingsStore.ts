export interface UserSettings {
  // 1. General & Watch Party Settings
  displayName: string;
  autoPlayOnConnect: boolean;
  syncToleranceMs: number; // 50, 100, 250, 500
  hostControlOnly: boolean;
  soundNotifications: boolean;
  autoReconnect: boolean;

  // 2. Video & Stream Engine
  defaultResolution: 'auto' | '1080p' | '720p' | '480p' | '360p';
  targetFps: 60 | 30 | 24;
  videoCodec: 'VP9' | 'VP8' | 'H264' | 'AV1';
  hardwareAcceleration: boolean;
  adaptiveBitrate: boolean;
  maxBitrateKbps: number;
  bufferTargetMs: number;

  // 3. Audio & Voice Chat
  audioBitrateKbps: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  audioSyncOffsetMs: number;
  stereoAudio: boolean;

  // 4. Subtitles & Player Appearance
  subtitleFontSize: 'small' | 'medium' | 'large' | 'xlarge';
  subtitleColor: string;
  subtitleBgOpacity: number;
  videoAspectRatio: 'contain' | 'cover' | 'fill';

  // 5. Network & WebRTC Signaling
  customSignalingServer: string;
  useCustomIceServers: boolean;
  iceServers: Array<{ urls: string; username?: string; credential?: string }>;
  forceRelayTurn: boolean;
  bundlePolicy: 'max-bundle' | 'balanced' | 'max-compat';

  // 6. Theme & Interface
  themeColor: 'blue' | 'emerald' | 'violet' | 'rose' | 'amber';
  darkStyle: 'oled' | 'midnight' | 'slate';
  showStatsOverlay: boolean;
  theaterModeAutoDim: boolean;
  language: 'fa' | 'en';
}

export const DEFAULT_SETTINGS: UserSettings = {
  // General & Watch Party
  displayName: 'کاربر Movie Together',
  autoPlayOnConnect: true,
  syncToleranceMs: 150,
  hostControlOnly: false,
  soundNotifications: true,
  autoReconnect: true,

  // Video
  defaultResolution: 'auto',
  targetFps: 60,
  videoCodec: 'VP9',
  hardwareAcceleration: true,
  adaptiveBitrate: true,
  maxBitrateKbps: 6000,
  bufferTargetMs: 50,

  // Audio
  audioBitrateKbps: 128,
  echoCancellation: true,
  noiseSuppression: true,
  audioSyncOffsetMs: 0,
  stereoAudio: true,

  // Subtitles & Player
  subtitleFontSize: 'medium',
  subtitleColor: '#FFFFFF',
  subtitleBgOpacity: 60,
  videoAspectRatio: 'contain',

  // Network & WebRTC
  customSignalingServer: '',
  useCustomIceServers: false,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  forceRelayTurn: false,
  bundlePolicy: 'max-bundle',

  // Theme & Interface
  themeColor: 'blue',
  darkStyle: 'oled',
  showStatsOverlay: false,
  theaterModeAutoDim: true,
  language: 'fa'
};

const STORAGE_KEY = 'movie_together_user_settings_v1';

export function loadSettings(): UserSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load settings from storage:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('movie-together-settings-changed', { detail: settings }));
  } catch (e) {
    console.error('Failed to save settings to storage:', e);
  }
}

export function resetSettings(): UserSettings {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('movie-together-settings-changed', { detail: DEFAULT_SETTINGS }));
  } catch (e) {
    console.error('Failed to reset settings:', e);
  }
  return DEFAULT_SETTINGS;
}
