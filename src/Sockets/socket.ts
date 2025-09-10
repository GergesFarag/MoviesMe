import { DefaultEventsMap, Server } from "socket.io";
import type http from "http";
import AppError from "../Utils/Errors/AppError";
let io: Server | null = null;
export function initSocket(server: http.Server) {
  io = new Server(server, {
    cors: { 
      origin: "*", 
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true
    },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 30000,
    connectTimeout: 45000,
    allowEIO3: true
  });
  
  io.on("connection", (socket) => {
    console.log(`✅ New socket connection established: ${socket.id}`);
    console.log(`📊 Total connected clients: ${io!.engine.clientsCount}`);
    
    socket.on("join:user", (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`🔗 Socket ${socket.id} joined user room: user:${userId}`);
    });
    
    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket ${socket.id} disconnected. Reason: ${reason}`);
      console.log(`📊 Total connected clients: ${io!.engine.clientsCount}`);
    });
    
    socket.on("error", (error) => {
      console.error(`🚨 Socket error on ${socket.id}:`, error);
    });
    
    socket.on("connect_error", (error) => {
      console.error(`🚨 Socket connection error on ${socket.id}:`, error);
    });
    
    // Add heartbeat mechanism
    socket.on("ping", () => {
      socket.emit("pong");
    });
  });
  
  io.engine.on("connection_error", (err) => {
    console.error("🚨 Socket.io engine connection error:", err);
  });
  
  console.log("🚀 Socket.io server initialized successfully");
  return io;
}
export function getIO() {
  if (!io) throw new AppError("Socket.io not initialized");
  return io;
}

export const sendWebsocket = (
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  event: string,
  data: any,
  to?: string
) => {
  if (to) {
    io.to(to).emit(event, data);
  } else {
    io.emit(event, data);
  }
};
