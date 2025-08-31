import { Server } from "socket.io";
import http from "http";

let io: Server | null = null;

export function initSocket(server: http.Server) {
  if (io) return io; // Prevent re-initializing the Socket.IO server

  io = new Server(server, {
    cors: {
      origin: "*", // Allow all origins (you can restrict this for security)
      methods: ["GET", "POST"],
    },
    transports: ["websocket"], // Ensures that WebSocket is used for communication
    pingInterval: 20000,
    pingTimeout: 20000,
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Listen for events from clients
    socket.on("join:user", (userId: string) => {
      const roomName = `user:${userId}`;
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room ${roomName}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket ${socket.id} disconnected: ${reason}`);
    });
  });

  console.log("Socket.IO server initialized");
  return io;
}
export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
}
