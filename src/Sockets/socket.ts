import { Server } from "socket.io";
import type http from "http";
import AppError from "../Utils/Errors/AppError";
let io: Server | null = null;
export function initSocket(server: http.Server) {
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
    pingInterval: 20000,
    pingTimeout: 20000,
  });
  io.on("connection", (socket) => {
    socket.on("join:user", (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`Socket ${socket.id} joined user room user:${userId}`);
    });
    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });
  return io;
}
export function getIO() {
  if (!io) throw new AppError("Socket.io not initialized");
  return io;
}
