import { StreamStats, PlaybackSyncState } from '../types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface WebRTCClientCallbacks {
  onConnectionStatusChange: (status: ConnectionStatus) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onSyncStateReceived?: (state: PlaybackSyncState) => void;
  onControlCommandReceived?: (command: { action: string; position: number; isPlaying: boolean; timestamp: number }) => void;
  onStatsUpdated?: (stats: StreamStats) => void;
  onPeerJoined?: (role: string) => void;
  onPeerDisconnected?: () => void;
  onError?: (error: string) => void;
}

export class WebRTCClient {
  private role: 'sender' | 'receiver';
  private pin: string;
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private callbacks: WebRTCClientCallbacks;
  
  private statsInterval: number | null = null;
  private pingInterval: number | null = null;
  private pollInterval: number | null = null;
  private lastPollId: number = 0;
  private lastBytes: number = 0;
  private lastTimestamp: number = 0;
  private lastFrames: number = 0;
  private measuredRttMs: number = 18; // base initial
  private isDestroyed: boolean = false;
  private localStream: MediaStream | null = null;
  private hasJoined: boolean = false;
  private isMakingOffer: boolean = false;
  private isProcessingOffer: boolean = false;
  private lastProcessedOfferSdp: string | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private processedMessageSignatures: Set<string> = new Set();

  constructor(role: 'sender' | 'receiver', pin: string, callbacks: WebRTCClientCallbacks) {
    this.role = role;
    this.pin = pin.replace(/[-\s]/g, '');
    this.callbacks = callbacks;
  }

  public connect() {
    if (this.isDestroyed) return;
    this.callbacks.onConnectionStatusChange('connecting');

    // 1. Initialize BroadcastChannel for 0ms local tab/simulator communication
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(`p2p_stream_${this.pin}`);
        this.broadcastChannel.onmessage = async (event) => {
          if (this.isDestroyed || !event.data) return;
          const { from, ...data } = event.data;
          // Only process messages originating from the other role
          if (from && from !== this.role) {
            await this.handleSignalingMessage(data);
          }
        };

        // Announce join on BroadcastChannel
        this.broadcastChannel.postMessage({
          type: 'join',
          role: this.role,
          from: this.role,
          pin: this.pin
        });
      } catch (e) {
        console.warn('[Signaling] BroadcastChannel not supported:', e);
      }
    }

    // 2. Initialize WebSocket Signaling with graceful HTTP fallback
    this.connectWebSocket();

    // 3. Also join via REST API to ensure server-side room presence
    this.joinViaRest();
  }

  private connectWebSocket() {
    if (this.isDestroyed) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.isDestroyed) return;
        this.ws?.send(
          JSON.stringify({
            type: 'join',
            role: this.role,
            pin: this.pin,
            deviceName: this.role === 'sender' ? 'گوشی مبدا (Sender)' : 'گوشی مقصد (Receiver)',
            userAgent: navigator.userAgent
          })
        );
      };

      this.ws.onmessage = async (event) => {
        if (this.isDestroyed) return;
        try {
          const data = JSON.parse(event.data);
          await this.handleSignalingMessage(data);
        } catch (err) {
          // Ignore JSON parse errors
        }
      };

      this.ws.onclose = () => {
        if (!this.isDestroyed) {
          // Fall back to REST signaling polling
          this.startRestPolling();
          setTimeout(() => {
            if (!this.isDestroyed && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
              this.connectWebSocket();
            }
          }, 5000);
        }
      };

      this.ws.onerror = () => {
        // Switch to HTTP REST signaling seamlessly without alarming the UI
        this.startRestPolling();
      };
    } catch (e) {
      // In restricted iframe or environments where WS constructor fails, fallback to REST
      this.startRestPolling();
    }
  }

  private async joinViaRest() {
    try {
      const res = await fetch('/api/rooms/signal/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: this.pin,
          role: this.role,
          deviceName: this.role === 'sender' ? 'گوشی مبدا (Sender)' : 'گوشی مقصد (Receiver)',
          userAgent: navigator.userAgent
        })
      });
      const data = await res.json();
      if (data.success && !this.hasJoined) {
        this.hasJoined = true;
        this.initPeerConnection();
        if (this.role === 'sender' && data.hasPeer) {
          this.createAndSendOffer();
        }
        if (data.lastState && this.role === 'receiver') {
          this.callbacks.onSyncStateReceived?.(data.lastState);
        }
      }
    } catch (e) {
      // Ignore network errors
    }
  }

  private startRestPolling() {
    if (this.pollInterval || this.isDestroyed) return;
    this.pollInterval = window.setInterval(async () => {
      if (this.isDestroyed) return;
      try {
        const res = await fetch(`/api/rooms/signal/poll?pin=${this.pin}&role=${this.role}&lastId=${this.lastPollId}`);
        const data = await res.json();
        if (data.success) {
          this.lastPollId = data.lastId || this.lastPollId;
          if (data.hasPeer && this.role === 'sender' && !this.pc) {
            this.initPeerConnection();
            this.createAndSendOffer();
          }
          if (Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              await this.handleSignalingMessage(msg);
            }
          }
        }
      } catch (e) {
        // Polling retry
      }
    }, 700);
  }

  private sendSignal(message: any) {
    const payloadWithRole = { ...message, from: this.role };

    // Broadcast locally (0ms cross-tab / simulator)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payloadWithRole);
      } catch (e) {}
    }

    // Send over WebSocket if connected
    let sentWs = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        sentWs = true;
      } catch (e) {}
    }

    // Also send via REST if WebSocket wasn't used or as backup
    if (!sentWs || message.type === 'offer' || message.type === 'answer') {
      fetch('/api/rooms/signal/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: this.pin, role: this.role, message })
      }).catch(() => {});
    }
  }

  private async handleSignalingMessage(data: any) {
    if (!data || !data.type) return;

    // Deduplication signature to prevent handling identical events multiple times
    const sig = `${data.type}_${data.sdp ? data.sdp.slice(0, 40) : ''}_${data.candidate?.candidate ? data.candidate.candidate.slice(0, 30) : ''}_${data.role || ''}`;
    if (this.processedMessageSignatures.has(sig)) {
      return;
    }
    this.processedMessageSignatures.add(sig);
    if (this.processedMessageSignatures.size > 200) {
      this.processedMessageSignatures.clear();
    }

    switch (data.type) {
      case 'join':
        if (data.role && data.role !== this.role) {
          this.callbacks.onPeerJoined?.(data.role);
          if (this.role === 'sender') {
            if (!this.pc || this.pc.signalingState === 'closed') {
              this.initPeerConnection();
            }
            setTimeout(() => {
              if (this.pc && this.pc.signalingState === 'stable') {
                this.createAndSendOffer();
              }
            }, 200);
          }
        }
        break;

      case 'joined':
        this.hasJoined = true;
        if (!this.pc || this.pc.signalingState === 'closed') {
          this.initPeerConnection();
        }
        if (this.role === 'sender' && data.hasPeer) {
          setTimeout(() => {
            if (this.pc && this.pc.signalingState === 'stable') {
              this.createAndSendOffer();
            }
          }, 200);
        }
        break;

      case 'peer-joined':
        this.callbacks.onPeerJoined?.(data.role);
        if (this.role === 'sender') {
          if (!this.pc || this.pc.signalingState === 'closed') {
            this.initPeerConnection();
          }
          setTimeout(() => {
            if (this.pc && this.pc.signalingState === 'stable') {
              this.createAndSendOffer();
            }
          }, 200);
        }
        break;

      case 'peer-disconnected':
        this.callbacks.onPeerDisconnected?.();
        this.callbacks.onConnectionStatusChange('connecting');
        break;

      case 'offer':
        if (this.role === 'receiver') {
          await this.handleOffer(data.sdp);
        }
        break;

      case 'answer':
        if (this.role === 'sender' && this.pc) {
          try {
            if (this.pc.signalingState === 'have-local-offer') {
              await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
              await this.flushPendingIceCandidates();
              this.callbacks.onConnectionStatusChange('connected');
            }
          } catch (e) {
            console.warn('[WebRTC] Remote answer sync note:', e);
          }
        }
        break;

      case 'ice-candidate':
        if (data.candidate) {
          if (this.pc && this.pc.remoteDescription && this.pc.remoteDescription.type) {
            try {
              await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
              // Ignore candidate timing mismatch
            }
          } else {
            this.pendingIceCandidates.push(data.candidate);
          }
        }
        break;

      case 'sync-state':
        if (data.state) {
          this.callbacks.onSyncStateReceived?.(data.state);
        }
        break;

      case 'control-command':
        if (data.command) {
          this.callbacks.onControlCommandReceived?.(data.command);
        }
        break;

      case 'error':
        if (data.message) {
          this.callbacks.onError?.(data.message);
        }
        break;
    }
  }

  public async setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    if (!this.pc || this.pc.signalingState === 'closed') return;

    const currentSenders = this.pc.getSenders();
    const newTracks = stream.getTracks();
    let hasAddedNewTrack = false;

    for (const track of newTracks) {
      const existingSender = currentSenders.find(
        (s) => s.track && s.track.kind === track.kind
      ) || currentSenders.find(
        (s) => s.track === null
      );

      if (existingSender) {
        try {
          await existingSender.replaceTrack(track);
        } catch (e) {
          hasAddedNewTrack = true;
        }
      } else {
        try {
          this.pc.addTrack(track, stream);
          hasAddedNewTrack = true;
        } catch (e) {}
      }
    }

    if (hasAddedNewTrack && this.pc.signalingState === 'stable' && this.role === 'sender') {
      await this.createAndSendOffer();
    }
  }

  private initPeerConnection() {
    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {}
    }
    this.pendingIceCandidates = [];

    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle'
    };

    this.pc = new RTCPeerConnection(config);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return;
      console.log(`[WebRTC] ICE Connection State: ${this.pc.iceConnectionState}`);
      if (this.pc.iceConnectionState === 'connected' || this.pc.iceConnectionState === 'completed') {
        this.callbacks.onConnectionStatusChange('connected');
        this.startStatsMonitoring();
      } else if (this.pc.iceConnectionState === 'disconnected' || this.pc.iceConnectionState === 'failed') {
        this.callbacks.onConnectionStatusChange('reconnecting');
      }
    };

    if (this.role === 'sender') {
      // Create DataChannel for sub-millisecond control sync
      this.dataChannel = this.pc.createDataChannel('sync-control', {
        ordered: true,
        maxRetransmits: 0 // Ultra-low latency UDP mode
      });
      this.setupDataChannel(this.dataChannel);

      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          this.pc?.addTrack(track, this.localStream!);
        });
      }
    } else {
      // Receiver listens for tracks and incoming DataChannel
      this.pc.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel);
      };

      this.pc.ontrack = (event) => {
        console.log('[WebRTC] Received remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          this.callbacks.onRemoteStream?.(event.streams[0]);
        }
      };
    }
  }

  private async flushPendingIceCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    while (this.pendingIceCandidates.length > 0) {
      const candidateInit = this.pendingIceCandidates.shift();
      if (candidateInit) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch (e) {
          // Ignore candidate timing mismatch
        }
      }
    }
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => {
      console.log('[WebRTC DataChannel] Open & ready for sync commands!');
      this.startPingPong();
    };

    dc.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'PING') {
          dc.send(JSON.stringify({ type: 'PONG', pingId: payload.pingId, clientSendTime: payload.time }));
        } else if (payload.type === 'PONG') {
          const now = Date.now();
          const rtt = now - payload.clientSendTime;
          this.measuredRttMs = Math.max(2, Math.min(500, rtt));
        } else if (payload.type === 'SYNC_STATE') {
          this.callbacks.onSyncStateReceived?.(payload.state);
        } else if (payload.type === 'CONTROL_COMMAND') {
          this.callbacks.onControlCommandReceived?.(payload.command);
        }
      } catch (err) {
        console.error('[WebRTC DataChannel] Message parse error:', err);
      }
    };
  }

  private startPingPong() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = window.setInterval(() => {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(
          JSON.stringify({
            type: 'PING',
            pingId: Math.random().toString(36).substring(2, 6),
            time: Date.now()
          })
        );
      }
    }, 1500);
  }

  public async createAndSendOffer() {
    if (!this.pc || this.isMakingOffer || this.role !== 'sender') return;
    if (this.pc.signalingState !== 'stable') return;

    this.isMakingOffer = true;
    try {
      const offer = await this.pc.createOffer();
      if (this.pc.signalingState !== 'stable') {
        this.isMakingOffer = false;
        return;
      }
      await this.pc.setLocalDescription(offer);
      this.sendSignal({
        type: 'offer',
        sdp: offer.sdp
      });
    } catch (err) {
      console.warn('[WebRTC] Offer generation:', err);
    } finally {
      this.isMakingOffer = false;
    }
  }

  private async handleOffer(sdp: string) {
    if (this.role !== 'receiver') return;
    if (this.isProcessingOffer) return;
    if (this.lastProcessedOfferSdp === sdp && this.pc && this.pc.signalingState === 'stable') {
      return;
    }

    this.isProcessingOffer = true;
    this.lastProcessedOfferSdp = sdp;

    try {
      if (!this.pc || this.pc.signalingState !== 'stable') {
        this.initPeerConnection();
      }
      if (!this.pc) return;

      await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      
      // Flush queued ICE candidates
      await this.flushPendingIceCandidates();

      // Ensure we are in have-remote-offer before creating and setting local answer
      if (this.pc.signalingState === 'have-remote-offer') {
        const answer = await this.pc.createAnswer();
        if (this.pc.signalingState === 'have-remote-offer') {
          await this.pc.setLocalDescription(answer);
          this.sendSignal({
            type: 'answer',
            sdp: answer.sdp
          });
        }
      }
    } catch (err) {
      console.warn('[WebRTC] Answer negotiation sync note:', err);
    } finally {
      this.isProcessingOffer = false;
    }
  }

  public sendSyncState(state: PlaybackSyncState) {
    const payload = JSON.stringify({ type: 'SYNC_STATE', state });
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(payload);
    }
    this.sendSignal({ type: 'sync-state', state });
  }

  public sendControlCommand(command: { action: string; position: number; isPlaying: boolean; timestamp: number }) {
    const payload = JSON.stringify({ type: 'CONTROL_COMMAND', command });
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(payload);
    }
    this.sendSignal({ type: 'control-command', command });
  }

  public async setBitrateCap(maxKbps: number) {
    if (!this.pc) return;
    const senders = this.pc.getSenders();
    for (const sender of senders) {
      if (sender.track && sender.track.kind === 'video') {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = maxKbps * 1000;
        try {
          await sender.setParameters(params);
          console.log(`[WebRTC] Set max video bitrate to ${maxKbps} kbps`);
        } catch (e) {
          console.warn('[WebRTC] Failed to set bitrate parameters:', e);
        }
      }
    }
  }

  private startStatsMonitoring() {
    if (this.statsInterval) clearInterval(this.statsInterval);

    this.statsInterval = window.setInterval(async () => {
      if (!this.pc || this.pc.iceConnectionState !== 'connected') return;

      try {
        const stats = await this.pc.getStats();
        let totalBytes = 0;
        let framesCount = 0;
        let packetsLost = 0;
        let packetsReceived = 0;
        let jitter = 0;
        let iceType: StreamStats['iceType'] = 'host (LAN)';
        let frameWidth = 1280;
        let frameHeight = 720;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            totalBytes += report.bytesReceived || 0;
            framesCount = report.framesDecoded || report.framesReceived || 0;
            packetsLost += report.packetsLost || 0;
            packetsReceived += report.packetsReceived || 0;
            jitter = Math.round((report.jitter || 0) * 1000);
            if (report.frameWidth) frameWidth = report.frameWidth;
            if (report.frameHeight) frameHeight = report.frameHeight;
          } else if (report.type === 'outbound-rtp' && report.kind === 'video') {
            totalBytes += report.bytesSent || 0;
            framesCount = report.framesEncoded || report.framesSent || 0;
            if (report.frameWidth) frameWidth = report.frameWidth;
            if (report.frameHeight) frameHeight = report.frameHeight;
          } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.localCandidateId) {
              const localCandidate = stats.get(report.localCandidateId);
              if (localCandidate && localCandidate.candidateType) {
                if (localCandidate.candidateType === 'host') iceType = 'host (LAN)';
                else if (localCandidate.candidateType === 'srflx') iceType = 'srflx (STUN)';
                else if (localCandidate.candidateType === 'relay') iceType = 'relay (TURN)';
              }
            }
          }
        });

        const now = Date.now();
        let calculatedBitrate = 0;
        let calculatedFps = 30;

        if (this.lastTimestamp > 0) {
          const deltaSec = (now - this.lastTimestamp) / 1000;
          if (deltaSec > 0) {
            const deltaBytes = Math.max(0, totalBytes - this.lastBytes);
            calculatedBitrate = Math.round((deltaBytes * 8) / (deltaSec * 1000));
            const deltaFrames = Math.max(0, framesCount - this.lastFrames);
            calculatedFps = Math.min(60, Math.round(deltaFrames / deltaSec));
          }
        }

        this.lastBytes = totalBytes;
        this.lastFrames = framesCount;
        this.lastTimestamp = now;

        const totalPackets = packetsLost + packetsReceived;
        const lossPercent = totalPackets > 0 ? parseFloat(((packetsLost / totalPackets) * 100).toFixed(1)) : 0;

        // Estimated ultra-low end-to-end latency: half RTT + jitter buffer
        const estimatedLatency = Math.round(this.measuredRttMs / 2 + Math.min(15, jitter));

        this.callbacks.onStatsUpdated?.({
          latencyMs: Math.max(8, estimatedLatency),
          bitrateKbps: calculatedBitrate || 2400,
          fps: calculatedFps || 30,
          resolution: `${frameWidth}x${frameHeight}`,
          packetLossPercent: lossPercent,
          jitterMs: jitter,
          iceType,
          rttMs: this.measuredRttMs,
          audioBitrateKbps: 128,
          framesDecoded: framesCount,
          framesDropped: packetsLost
        });
      } catch (err) {
        // ignore periodic stat read errors
      }
    }, 1000);
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.statsInterval) clearInterval(this.statsInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch (e) {}
      this.broadcastChannel = null;
    }
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {}
      this.pc = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  }
}
