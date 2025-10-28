import { DefaultEventsMap, Server } from 'socket.io';
import type http from 'http';
import AppError from '../Utils/Errors/AppError';
let io: Server | null = null;

export function initSocket(server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['*'],
      credentials: true,
    },
    path: '/socket.io/', // Explicit path for Flutter clients
    transports: ['polling', 'websocket'], // Polling first for mobile compatibility
    pingInterval: 25000, // 25 seconds - more frequent to detect issues faster
    pingTimeout: 120000, // 120 seconds (2 minutes) - very tolerant for long operations
    connectTimeout: 45000, // 45 seconds
    upgradeTimeout: 30000, // 30 seconds
    maxHttpBufferSize: 1e8, // 100MB
    allowUpgrades: true, // Allow upgrade from polling to websocket
    httpCompression: true,
    perMessageDeflate: {
      threshold: 1024,
      concurrencyLimit: 10,
      windowBits: 13,
    },
    // Additional mobile-friendly options
    serveClient: false, // Don't serve client files
    cookie: false, // Disable cookies for mobile apps
    // Allow requests validation
    allowRequest: (req, callback) => {
      // Log connection attempts for debugging
      console.log(
        `📱 Connection attempt from: ${req.headers.origin || 'Unknown'}`
      );
      console.log(
        `   User-Agent: ${
          req.headers['user-agent']?.substring(0, 50) || 'Unknown'
        }...`
      );

      // Accept all requests (CORS is already configured above)
      callback(null, true);
    },
  });

  io.on('connection', (socket) => {
    console.log(
      `✅ Socket ${socket.id} connected (Total: ${io!.engine.clientsCount})`
    );
    console.log(`   Transport: ${socket.conn.transport.name}`);
    console.log(`   Handshake: ${JSON.stringify(socket.handshake.query)}`);

    // Log current rooms for debugging
    console.log(
      '📋 Current rooms:',
      Array.from(io!.sockets.adapter.rooms.keys())
    );

    const joinUserHandler = (userId: string) => {
      if (!userId) {
        console.error('❌ Join user failed: userId is required');
        socket.emit('socket:error', {
          error: 'userId is required',
          timestamp: Date.now(),
        });
        return;
      }

      socket.join(`user:${userId}`);
      console.log(`🔗 Socket ${socket.id} joined room: user:${userId}`);
      console.log(
        '📋 Updated rooms:',
        Array.from(io!.sockets.adapter.rooms.keys())
      );

      socket.emit('connection:confirmed', {
        socketId: socket.id,
        userId: userId,
        timestamp: Date.now(),
      });
    };

    const disconnectHandler = (reason: string) => {
      console.log(
        `❌ Socket ${socket.id} disconnected: ${reason} (Remaining: ${
          io!.engine.clientsCount
        })`
      );

      // Clean up all event listeners to prevent memory leaks
      socket.removeAllListeners('join:user');
      socket.removeAllListeners('ping');
      socket.removeAllListeners('health:check');
      socket.removeAllListeners('error');
    };

    // Ping/Pong handler
    const pingHandler = () => {
      socket.emit('pong', {
        timestamp: Date.now(),
        socketId: socket.id,
      });
    };

    // Health check handler
    const healthCheckHandler = () => {
      const rooms = Array.from(socket.rooms);
      socket.emit('health:response', {
        status: 'healthy',
        socketId: socket.id,
        rooms: rooms,
        timestamp: Date.now(),
      });
    };

    // Error handler
    const errorHandler = (error: Error) => {
      console.error(`🚨 Socket ${socket.id} error:`, error.message);
      socket.emit('socket:error', {
        error: error.message,
        timestamp: Date.now(),
      });
    };

    // Attach event listeners
    socket.on('join:user', joinUserHandler);
    socket.on('disconnect', disconnectHandler);
    socket.on('ping', pingHandler);
    socket.on('health:check', healthCheckHandler);
    socket.on('error', errorHandler);

    // Monitor transport upgrades
    socket.conn.on('upgrade', (transport) => {
      console.log(`🔄 Socket ${socket.id} upgraded to: ${transport.name}`);
    });

    socket.conn.on('packet', (packet) => {
      // Log only important packets, not ping/pong
      if (packet.type !== 'ping' && packet.type !== 'pong') {
        console.log(`📦 Socket ${socket.id} packet: ${packet.type}`);
      }
    });

    socket.conn.on('packetCreate', (packet) => {
      // Debug outgoing packets for connection issues
      if (packet.type !== 'ping' && packet.type !== 'pong') {
        console.log(`📤 Socket ${socket.id} sending: ${packet.type}`);
      }
    });
  });

  // Global error handlers for the engine
  io.engine.on('connection_error', (err) => {
    console.error('❌ Engine connection error:', {
      message: err.message,
      code: err.code,
      context: err.context,
    });
  });

  console.log('🚀 Socket.io server initialized successfully');
  return io;
}

export function getIO() {
  if (!io) throw new AppError('Socket.io not initialized');
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
      event: event,
    };

    if (to) {
      const room = io.sockets.adapter.rooms.get(to);
      if (room && room.size > 0) {
        io.to(to).emit(event, payload);
        console.log(
          `📡 WebSocket event '${event}' sent to room '${to}' (${room.size} clients)`
        );
      } else {
        console.warn(
          `⚠️ No clients in room '${to}' for event '${event}'. Available rooms:`,
          Array.from(io.sockets.adapter.rooms.keys())
        );
      }
    } else {
      io.emit(event, payload);
      console.log(
        `📡 WebSocket event '${event}' broadcast to all clients (${io.engine.clientsCount} total)`
      );
    }
  } catch (error) {
    console.error(`🚨 Error sending WebSocket event '${event}':`, error);
    try {
      const errorPayload = {
        error: 'Failed to send progress update',
        originalEvent: event,
        timestamp: Date.now(),
      };

      if (to) {
        io.to(to).emit('socket:error', errorPayload);
      } else {
        io.emit('socket:error', errorPayload);
      }
    } catch (fallbackError) {
      console.error('🚨 Failed to send error notification:', fallbackError);
    }
  }
};
