import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface QueuedMessage {
  id: number;
  from: "sender" | "receiver";
  target: "sender" | "receiver";
  data: any;
  timestamp: number;
}

interface Room {
  id: string;
  pin: string;
  createdAt: number;
  sender?: WebSocket;
  receiver?: WebSocket;
  senderInfo?: { name: string; userAgent: string };
  receiverInfo?: { name: string; userAgent: string };
  messages: QueuedMessage[];
  messageCounter: number;
  lastState?: {
    currentTime: number;
    isPlaying: boolean;
    duration: number;
    videoTitle: string;
  };
}

const rooms = new Map<string, Room>();

// Cleanup stale rooms older than 4 hours
setInterval(() => {
  const now = Date.now();
  for (const [pin, room] of rooms.entries()) {
    if (now - room.createdAt > 4 * 60 * 60 * 1000) {
      if (room.sender && room.sender.readyState === WebSocket.OPEN) {
        room.sender.close();
      }
      if (room.receiver && room.receiver.readyState === WebSocket.OPEN) {
        room.receiver.close();
      }
      rooms.delete(pin);
    }
  }
}, 60000);

function generatePin(): string {
  let pin = "";
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(pin));
  return pin;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json());

  // REST API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", activeRooms: rooms.size, timestamp: Date.now() });
  });

  app.post("/api/rooms/create", (req, res) => {
    const pin = generatePin();
    const room: Room = {
      id: "room_" + Math.random().toString(36).substring(2, 9),
      pin,
      createdAt: Date.now(),
      messages: [],
      messageCounter: 0
    };
    rooms.set(pin, room);
    res.json({ success: true, pin, roomId: room.id });
  });

  app.post("/api/rooms/verify", (req, res) => {
    const { pin } = req.body;
    const cleanPin = (pin || "").toString().trim().replace(/[-\s]/g, "");
    const room = rooms.get(cleanPin);
    if (!room) {
      return res.status(404).json({ success: false, error: "اتاق با این کد یافت نشد یا منقضی شده است." });
    }
    const hasSender = !!(room.sender && room.sender.readyState === WebSocket.OPEN) || !!room.senderInfo;
    res.json({
      success: true,
      pin: cleanPin,
      roomId: room.id,
      hasSender,
      hasReceiver: !!(room.receiver && room.receiver.readyState === WebSocket.OPEN) || !!room.receiverInfo,
      lastState: room.lastState
    });
  });

  // REST Signaling Fallback Endpoints (For environments where WebSocket upgrade is blocked)
  app.post("/api/rooms/signal/join", (req, res) => {
    const { pin, role, deviceName, userAgent } = req.body;
    const cleanPin = (pin || "").toString().trim().replace(/[-\s]/g, "");
    let room = rooms.get(cleanPin);

    if (role === "sender") {
      if (!room) {
        room = {
          id: "room_" + Math.random().toString(36).substring(2, 9),
          pin: cleanPin,
          createdAt: Date.now(),
          messages: [],
          messageCounter: 0
        };
        rooms.set(cleanPin, room);
      }
      room.senderInfo = { name: deviceName || "گوشی مبدا", userAgent: userAgent || "Android / Web" };
      return res.json({
        success: true,
        role: "sender",
        hasPeer: !!room.receiverInfo || !!(room.receiver && room.receiver.readyState === WebSocket.OPEN),
        peerInfo: room.receiverInfo
      });
    } else {
      if (!room) {
        return res.status(404).json({ success: false, error: "کد اتاق یافت نشد" });
      }
      room.receiverInfo = { name: deviceName || "گوشی مقصد", userAgent: userAgent || "Android / Web" };

      // Queue peer-joined notification for sender
      room.messages.push({
        id: ++room.messageCounter,
        from: "receiver",
        target: "sender",
        data: { type: "peer-joined", role: "receiver", peerInfo: room.receiverInfo },
        timestamp: Date.now()
      });

      return res.json({
        success: true,
        role: "receiver",
        hasPeer: !!room.senderInfo || !!(room.sender && room.sender.readyState === WebSocket.OPEN),
        peerInfo: room.senderInfo,
        lastState: room.lastState
      });
    }
  });

  app.post("/api/rooms/signal/send", (req, res) => {
    const { pin, role, message } = req.body;
    const cleanPin = (pin || "").toString().trim().replace(/[-\s]/g, "");
    const room = rooms.get(cleanPin);
    if (!room) return res.status(404).json({ success: false, error: "Room not found" });

    const targetRole: "sender" | "receiver" = role === "sender" ? "receiver" : "sender";

    // If target has WebSocket open, push via WebSocket
    const targetWs = targetRole === "sender" ? room.sender : room.receiver;
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
      targetWs.send(JSON.stringify(message));
    }

    // Also queue for HTTP polling
    room.messages.push({
      id: ++room.messageCounter,
      from: role,
      target: targetRole,
      data: message,
      timestamp: Date.now()
    });

    if (message?.type === "sync-state" && message.state) {
      room.lastState = message.state;
    }

    // Keep queue at max 100 messages
    if (room.messages.length > 100) {
      room.messages = room.messages.slice(-60);
    }

    res.json({ success: true, messageId: room.messageCounter });
  });

  app.get("/api/rooms/signal/poll", (req, res) => {
    const pin = (req.query.pin || "").toString().trim().replace(/[-\s]/g, "");
    const role = (req.query.role || "").toString() as "sender" | "receiver";
    const lastId = parseInt((req.query.lastId || "0").toString(), 10);

    const room = rooms.get(pin);
    if (!room) return res.json({ success: false, messages: [], lastId: 0 });

    const pending = room.messages.filter((m) => m.target === role && m.id > lastId);
    const newestId = room.messages.length > 0 ? room.messages[room.messages.length - 1].id : lastId;

    res.json({
      success: true,
      messages: pending.map((m) => m.data),
      lastId: newestId,
      hasPeer: role === "sender" ? !!room.receiverInfo : !!room.senderInfo
    });
  });

  // WebSocket Server with noServer to prevent Vite conflict
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
      if (url.pathname === "/ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      }
    } catch (e) {
      // Ignore upgrade parse errors
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    let currentPin: string | null = null;
    let currentRole: "sender" | "receiver" | null = null;

    ws.on("message", (rawMessage: string) => {
      try {
        const data = JSON.parse(rawMessage.toString());
        const { type } = data;

        if (type === "join") {
          const cleanPin = (data.pin || "").toString().trim().replace(/[-\s]/g, "");
          let room = rooms.get(cleanPin);

          if (data.role === "sender") {
            if (!room) {
              room = {
                id: "room_" + Math.random().toString(36).substring(2, 9),
                pin: cleanPin,
                createdAt: Date.now(),
                messages: [],
                messageCounter: 0
              };
              rooms.set(cleanPin, room);
            }
            room.sender = ws;
            room.senderInfo = {
              name: data.deviceName || "دستگاه مبدا",
              userAgent: data.userAgent || "Android / Web"
            };
            currentPin = cleanPin;
            currentRole = "sender";

            ws.send(JSON.stringify({
              type: "joined",
              role: "sender",
              pin: cleanPin,
              hasPeer: !!(room.receiver && room.receiver.readyState === WebSocket.OPEN) || !!room.receiverInfo,
              peerInfo: room.receiverInfo
            }));

            // Notify receiver if already connected
            if (room.receiver && room.receiver.readyState === WebSocket.OPEN) {
              room.receiver.send(JSON.stringify({
                type: "peer-joined",
                role: "sender",
                peerInfo: room.senderInfo
              }));
            }
          } else if (data.role === "receiver") {
            if (!room) {
              return ws.send(JSON.stringify({
                type: "error",
                message: "کد اتصال نامعتبر است یا جلسه مبدا هنوز ایجاد نشده است."
              }));
            }
            room.receiver = ws;
            room.receiverInfo = {
              name: data.deviceName || "دستگاه مقصد",
              userAgent: data.userAgent || "Android / Web"
            };
            currentPin = cleanPin;
            currentRole = "receiver";

            ws.send(JSON.stringify({
              type: "joined",
              role: "receiver",
              pin: cleanPin,
              hasPeer: !!(room.sender && room.sender.readyState === WebSocket.OPEN) || !!room.senderInfo,
              peerInfo: room.senderInfo,
              lastState: room.lastState
            }));

            // Notify sender that receiver is ready to receive offer
            if (room.sender && room.sender.readyState === WebSocket.OPEN) {
              room.sender.send(JSON.stringify({
                type: "peer-joined",
                role: "receiver",
                peerInfo: room.receiverInfo
              }));
            }
          }
          return;
        }

        if (!currentPin) return;
        const room = rooms.get(currentPin);
        if (!room) return;

        // Relay WebRTC signaling messages
        if (type === "offer" || type === "answer" || type === "ice-candidate" || type === "renegotiate-request") {
          const target = currentRole === "sender" ? room.receiver : room.sender;
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify(data));
          }
          // Also save in queue for HTTP polling
          room.messages.push({
            id: ++room.messageCounter,
            from: currentRole!,
            target: currentRole === "sender" ? "receiver" : "sender",
            data,
            timestamp: Date.now()
          });
          return;
        }

        // State & Playback sync fallback over signaling
        if (type === "sync-state") {
          room.lastState = data.state;
          const target = currentRole === "sender" ? room.receiver : room.sender;
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify(data));
          }
          return;
        }

        if (type === "control-command") {
          const target = currentRole === "sender" ? room.receiver : room.sender;
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify(data));
          }
          return;
        }

        if (type === "ping") {
          ws.send(JSON.stringify({ type: "pong", clientTimestamp: data.timestamp, serverTimestamp: Date.now() }));
          return;
        }
      } catch (err) {
        console.error("Signaling message parse error:", err);
      }
    });

    ws.on("close", () => {
      if (currentPin) {
        const room = rooms.get(currentPin);
        if (room) {
          if (currentRole === "sender" && room.sender === ws) {
            delete room.sender;
            if (room.receiver && room.receiver.readyState === WebSocket.OPEN) {
              room.receiver.send(JSON.stringify({ type: "peer-disconnected", role: "sender" }));
            }
          } else if (currentRole === "receiver" && room.receiver === ws) {
            delete room.receiver;
            if (room.sender && room.sender.readyState === WebSocket.OPEN) {
              room.sender.send(JSON.stringify({ type: "peer-disconnected", role: "receiver" }));
            }
          }

          if (!room.sender && !room.receiver) {
            setTimeout(() => {
              const r = rooms.get(currentPin!);
              if (r && !r.sender && !r.receiver) {
                rooms.delete(currentPin!);
              }
            }, 300000);
          }
        }
      }
    });
  });

  // Vite middleware for development vs static production build
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Movie Together server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
