import { DefaultEventsMap, Server } from 'socket.io';
import type http from 'http';
import AppError from '../Utils/Errors/AppError';

// Global Socket.IO instance
let io: Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
> | null = null;

/**
 * Initialize Socket.IO server with long-running job support
 * Configures pingTimeout and pingInterval to prevent disconnections during long processing tasks
 * @param server - HTTP server instance
 * @returns Socket.IO server instance
 */
export const initSocket = (
  server: http.Server
): Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> => {
  if (io) {
    console.warn(
      '⚠️ Socket.IO already initialized. Returning existing instance.'
    );
    return io;
  }

  io = new Server(server, {
    cors: {
      origin: '*', // Configure this based on your environment
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Critical settings for long-running jobs (15+ minutes)
    // Increased timeouts to handle heavy video processing operations
    pingTimeout: 120000, // 120 seconds (2 minutes) - how long to wait for pong before considering connection dead
    pingInterval: 45000, // 45 seconds - how often to send ping packets
    connectTimeout: 60000, // 60 seconds - connection timeout
    // Increase max HTTP buffer size for large payloads
    maxHttpBufferSize: 1e8, // 100 MB
    // Allow for multiple reconnection attempts
    allowEIO3: true,
    // Transport options
    transports: ['websocket', 'polling'],
    // Upgrade timeout - important for polling -> websocket upgrade
    upgradeTimeout: 30000,
  });

  // Connection event handler
  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Handle room joining for user-specific updates
    socket.on('join:user', (roomId: string) => {
      try {
        if (!roomId) {
          socket.emit('socket:error', { error: 'Room ID is required' });
          return;
        }

        socket.join(roomId);
        console.log(`👤 Socket ${socket.id} joined room: ${roomId}`);

        // Confirm room join
        socket.emit('room-joined', {
          roomId,
          socketId: socket.id,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error(`❌ Error joining room ${roomId}:`, error);
        socket.emit('socket:error', { error: 'Failed to join room' });
      }
    });

    // Handle room leaving
    socket.on('leave-room', (roomId: string) => {
      try {
        if (!roomId) {
          socket.emit('socket:error', { error: 'Room ID is required' });
          return;
        }

        socket.leave(roomId);
        console.log(`👋 Socket ${socket.id} left room: ${roomId}`);

        socket.emit('room-left', {
          roomId,
          socketId: socket.id,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error(`❌ Error leaving room ${roomId}:`, error);
        socket.emit('socket:error', { error: 'Failed to leave room' });
      }
    });

    // Heartbeat/ping handler to keep connection alive during long jobs
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} - Reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`🚨 Socket error for ${socket.id}:`, error);
    });
  });

  console.log('✅ Socket.IO initialized with long-running job support');
  console.log(`   - Ping Interval: 45s`);
  console.log(`   - Ping Timeout: 120s (2 minutes)`);
  console.log(`   - Connect Timeout: 60s`);
  console.log(`   - Max HTTP Buffer: 100MB`);

  return io;
};

export const getIO = (): Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
> => {
  if (!io) {
    throw new AppError(
      'Socket.IO not initialized. Call initSocket first.',
      500
    );
  }
  return io;
};

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
      console.log('Broadcast Sending...');
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
