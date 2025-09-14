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
    // Increased timeouts for production stability
    pingInterval: 60000,    // 60 seconds (was 25s)
    pingTimeout: 120000,    // 120 seconds (was 30s) 
    connectTimeout: 180000, // 180 seconds (was 45s)
    // Enhanced configuration for production
    upgradeTimeout: 30000,  // 30 seconds for transport upgrade
    maxHttpBufferSize: 1e8, // 100MB for large data transfers
    allowEIO3: true,
    // Sticky session support for load balancers
    cookie: {
      name: "io",
      httpOnly: true,
      sameSite: "lax"
    }
  });
  
  io.on("connection", (socket) => {
    console.log(`✅ New socket connection established: ${socket.id}`);
    console.log(`📊 Total connected clients: ${io!.engine.clientsCount}`);
    
    // Set socket timeout for long-running operations
    socket.timeout(300000); // 5 minutes for story generation
    
    socket.on("join:user", (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`🔗 Socket ${socket.id} joined user room: user:${userId}`);
      
      // Send connection confirmation
      socket.emit("connection:confirmed", {
        socketId: socket.id,
        userId: userId,
        timestamp: Date.now()
      });
    });
    
    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket ${socket.id} disconnected. Reason: ${reason}`);
      console.log(`📊 Total connected clients: ${io!.engine.clientsCount}`);
      
      // Log additional disconnect details for debugging
      if (reason === "ping timeout") {
        console.warn(`⚠️ Ping timeout for socket ${socket.id} - potential network issue`);
      } else if (reason === "transport close") {
        console.warn(`⚠️ Transport closed for socket ${socket.id} - potential connection issue`);
      }
    });
    
    socket.on("error", (error) => {
      console.error(`🚨 Socket error on ${socket.id}:`, error);
      
      // Emit error details to client for debugging
      socket.emit("socket:error", {
        error: error.message,
        timestamp: Date.now()
      });
    });
    
    socket.on("connect_error", (error) => {
      console.error(`🚨 Socket connection error on ${socket.id}:`, error);
    });
    
    // Enhanced heartbeat mechanism
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });
    
    // Client can request connection health check
    socket.on("health:check", () => {
      socket.emit("health:response", {
        status: "healthy",
        socketId: socket.id,
        connectedClients: io!.engine.clientsCount,
        timestamp: Date.now()
      });
    });
    
    // Handle client-side reconnection attempts
    socket.on("reconnect:attempt", (data) => {
      console.log(`🔄 Reconnection attempt from socket ${socket.id}:`, data);
      socket.emit("reconnect:success", {
        socketId: socket.id,
        timestamp: Date.now()
      });
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
  try {
    const payload = {
      ...data,
      timestamp: Date.now(),
      event: event
    };
    
    if (to) {
      const room = io.sockets.adapter.rooms.get(to);
      if (room && room.size > 0) {
        io.to(to).emit(event, payload);
        console.log(`📡 WebSocket event '${event}' sent to room '${to}' (${room.size} clients)`);
      } else {
        console.warn(`⚠️ No clients in room '${to}' for event '${event}'`);
        // Store the message for when client reconnects (optional implementation)
      }
    } else {
      io.emit(event, payload);
      console.log(`📡 WebSocket event '${event}' broadcast to all clients (${io.engine.clientsCount} total)`);
    }
  } catch (error) {
    console.error(`🚨 Error sending WebSocket event '${event}':`, error);
    
    // Try to emit error notification to the specific room/client
    try {
      const errorPayload = {
        error: "Failed to send progress update",
        originalEvent: event,
        timestamp: Date.now()
      };
      
      if (to) {
        io.to(to).emit("socket:error", errorPayload);
      } else {
        io.emit("socket:error", errorPayload);
      }
    } catch (fallbackError) {
      console.error("🚨 Failed to send error notification:", fallbackError);
    }
  }
};
