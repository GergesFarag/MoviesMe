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
    // Try polling first, then upgrade to websocket for more stability
    transports: ["polling", "websocket"],
    pingInterval: 90000,    // 90 seconds (1.5 minutes) - when to check if idle
    pingTimeout: 90000,     // 90 seconds (1.5 minutes) - how long to wait for pong
    // Total idle timeout = pingInterval + pingTimeout = 180 seconds (3 minutes)
    connectTimeout: 45000,  // 45 seconds for initial connection
    upgradeTimeout: 30000,  // 30 seconds for transport upgrade
    maxHttpBufferSize: 1e8, // 100MB for large data transfers
    // Add additional stability options
    allowUpgrades: true,
    httpCompression: true,
    perMessageDeflate: {
      threshold: 1024,
      concurrencyLimit: 10,
      windowBits: 13,
    }
  });
  
  io.on("connection", (socket) => {
    console.log(`✅ New socket connection established: ${socket.id}`);
    console.log(`📊 Total connected clients: ${io!.engine.clientsCount}`);

    // Log initial connection details
    console.log(`🔍 Connection details:`, {
      transport: socket.conn?.transport?.name,
      upgraded: socket.conn?.upgraded,
      readyState: socket.conn?.readyState,
      handshake: {
        address: socket.handshake.address,
        time: new Date(socket.handshake.time).toISOString(),
        headers: {
          userAgent: socket.handshake.headers['user-agent'],
          origin: socket.handshake.headers.origin,
          connection: socket.handshake.headers.connection,
          upgrade: socket.handshake.headers.upgrade
        }
      }
    });
    

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
      

      if (reason === "transport close") {
        console.warn(`⚠️ Transport closed for socket ${socket.id}`);
        
        // Try to get as much info as possible before connection is fully closed
        const connectionInfo = {
          transport: socket.conn?.transport?.name || "unknown",
          readyState: socket.conn?.readyState || "unknown",
          upgraded: socket.conn?.upgraded || false,
          requestUrl: socket.conn?.request?.url || "unknown",
          connectionTime: Date.now() - new Date(socket.handshake.time).getTime()
        };
        
        console.warn(`🔍 Transport details:`, connectionInfo);
        
        // Log client information for debugging
        const clientInfo = {
          userAgent: socket.handshake.headers['user-agent'] || "unknown",
          origin: socket.handshake.headers.origin || "unknown",
          referer: socket.handshake.headers.referer || "unknown",
          remoteAddress: socket.handshake.address || "unknown",
          forwarded: socket.handshake.headers['x-forwarded-for'] || "none",
          realIp: socket.handshake.headers['x-real-ip'] || "none"
        };
        
        console.warn(`👤 Client details:`, clientInfo);
        
        // Check if this was during message sending
        const recentActivity = socket.data?.lastActivity || "none";
        console.warn(`📝 Recent activity:`, { lastActivity: recentActivity });
        
        // Try to determine what might have caused the close
        if (connectionInfo.connectionTime < 5000) {
          console.warn(`⚡ Quick disconnect (${connectionInfo.connectionTime}ms) - possible network issue`);
        } else if (connectionInfo.transport === "polling") {
          console.warn(`📡 Was using polling transport - possible upgrade failure`);
        } else if (typeof connectionInfo.readyState === 'number' && connectionInfo.readyState === 3) {
          console.warn(`🔒 ReadyState 3 (CLOSED) - transport was forcibly closed`);
        }
        
      } else if (reason === "ping timeout") {
        console.warn(`⚠️ Ping timeout for socket ${socket.id} - potential network issue`);
        console.warn(`⏱️ Connection duration: ${Date.now() - new Date(socket.handshake.time).getTime()}ms`);
      } else if (reason === "client namespace disconnect") {
        console.info(`ℹ️ Client ${socket.id} disconnected voluntarily`);
      } else if (reason === "server namespace disconnect") {
        console.info(`ℹ️ Server disconnected client ${socket.id}`);
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
    
    // Enhanced heartbeat mechanism with more detailed tracking
    socket.on("ping", () => {
      socket.emit("pong", { 
        timestamp: Date.now(),
        socketId: socket.id,
        transport: socket.conn?.transport?.name
      });
    });
    
    // Client can request connection health check
    socket.on("health:check", () => {
      socket.emit("health:response", {
        status: "healthy",
        socketId: socket.id,
        connectedClients: io!.engine.clientsCount,
        transport: socket.conn?.transport?.name,
        upgraded: socket.conn?.upgraded,
        readyState: socket.conn?.readyState,
        timestamp: Date.now()
      });
    });

    // Note: No periodic keep-alive messages
    // Connection will timeout after 3 minutes of true inactivity
    // (90s idle + 90s waiting for pong = 180s total)
  });
  
  io.engine.on("connection_error", (err) => {
    console.error("🚨 Socket.io engine connection error:", err);
    console.error("Error details:", {
      message: err.message,
      type: err.type,
      description: err.description,
      context: err.context,
      code: err.code
    });
  });
  
  io.engine.on("initial_headers", (headers, request) => {
    console.log("📡 Initial headers for connection:", {
      userAgent: request.headers['user-agent'],
      origin: request.headers.origin,
      connection: request.headers.connection,
      upgrade: request.headers.upgrade
    });
  });


  io.engine.on("connection", (socket) => {
    console.log(`🔌 Engine connection established: ${socket.id}`);
    
    socket.on("upgrade", () => {
      console.log(`⬆️ Socket ${socket.id} upgraded to WebSocket`);
    });
    
    socket.on("upgradeError", (error: any) => {
      console.error(`❌ Socket ${socket.id} upgrade failed:`, error);
    });
    
    socket.on("close", (reason: any) => {
      console.warn(`🔒 Engine socket ${socket.id} closed. Reason: ${reason}`);
    });
    
    socket.on("error", (error: any) => {
      console.error(`🚨 Engine socket ${socket.id} error:`, error);
    });
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
    
    const activityInfo = {
      event,
      timestamp: Date.now(),
      roomSize: to ? io.sockets.adapter.rooms.get(to)?.size || 0 : io.engine.clientsCount
    };
    
    if (to) {
      const room = io.sockets.adapter.rooms.get(to);
      if (room && room.size > 0) {
        room.forEach(socketId => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.data = socket.data || {};
            socket.data.lastActivity = activityInfo;
          }
        });
        
        io.to(to).emit(event, payload);
        console.log(`📡 WebSocket event '${event}' sent to room '${to}' (${room.size} clients)`);
      } else {
        console.warn(`⚠️ No clients in room '${to}' for event '${event}'`);
      }
    } else {
      io.sockets.sockets.forEach(socket => {
        socket.data = socket.data || {};
        socket.data.lastActivity = activityInfo;
      });
      
      io.emit(event, payload);
      console.log(`📡 WebSocket event '${event}' broadcast to all clients (${io.engine.clientsCount} total)`);
    }
  } catch (error) {
    console.error(`🚨 Error sending WebSocket event '${event}':`, error);
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
