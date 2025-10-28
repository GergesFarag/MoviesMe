import { DefaultEventsMap, Server } from 'socket.io';
import type http from 'http';
import AppError from '../Utils/Errors/AppError';
let io: Server | null = null;

export function initSocket(server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['*'],
      credentials: true,
    },
    transports: ['polling', 'websocket'],
    pingInterval: 90000, // 90 seconds
    pingTimeout: 90000, // 90 seconds
    connectTimeout: 45000, // 45 seconds
    upgradeTimeout: 30000, // 30 seconds
    maxHttpBufferSize: 1e8, // 100MB
    allowUpgrades: true,
    httpCompression: true,
    perMessageDeflate: {
      threshold: 1024,
      concurrencyLimit: 10,
      windowBits: 13,
    },
  });

  io.on('connection', (socket) => {
    console.log(
      `✅ Socket ${socket.id} connected (Total: ${io!.engine.clientsCount})`
    );

    const joinUserHandler = (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`🔗 Socket ${socket.id} joined room: user:${userId}`);

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
    socket.on('error', errorHandler);
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
        console.warn(`⚠️ No clients in room '${to}' for event '${event}'`);
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
