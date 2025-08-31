import { Server, Socket } from "socket.io";
import type http from "http";
import AppError from "../Utils/Errors/AppError";

let io: Server | null = null;

export function initSocket(server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket"],
    pingInterval: 20000,
    pingTimeout: 20000,
  });

  io.on("connection", (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on("join:user", (userId: string) => {
      const roomName = `user:${userId}`;
      socket.join(roomName);
      console.log(`✅ Socket ${socket.id} joined room ${roomName}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Client ${socket.id} disconnected: ${reason}`);
    });

    socket.on("error", (error) => {
      console.error(`⚠️ Socket error from ${socket.id}:`, error);
    });
  });

  console.log("🚀 Socket.IO server initialized");
  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new AppError("Socket.IO not initialized");
  }
  return io;
}
