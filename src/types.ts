export type AppMode = 'sender' | 'receiver' | 'dual' | 'settings';

export type VideoSourceType = 'sample' | 'file' | 'camera' | 'screen';

export interface SampleVideo {
  id: string;
  title: string;
  titleFa: string;
  duration: number;
  url: string;
  thumbnail: string;
  resolution: string;
  fps: number;
  descriptionFa: string;
}

export interface StreamStats {
  latencyMs: number;
  bitrateKbps: number;
  fps: number;
  resolution: string;
  packetLossPercent: number;
  jitterMs: number;
  iceType: 'host (LAN)' | 'srflx (STUN)' | 'relay (TURN)' | 'local-direct' | 'calculating';
  rttMs: number;
  audioBitrateKbps: number;
  framesDecoded: number;
  framesDropped: number;
}

export interface PlaybackSyncState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  timestamp: number;
  sourceTitle: string;
}

export interface QualityPreset {
  id: string;
  nameFa: string;
  nameEn: string;
  maxBitrateKbps: number;
  scaleDown: number;
  maxFps: number;
}
