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
    pingInterval: 25000,
    pingTimeout: 12000,
    transports: ['websocket'],
    maxHttpBufferSize: 1e8,
  });

  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    socket.on('join:user', (userId: string) => {
      try {
        if (!userId) {
          socket.emit('socket:error', { error: 'userId is required' });
          return;
        }

        socket.join(userId);
        console.log(`👤 Socket ${socket.id} joined room: ${userId}`);
      } catch (error) {
        socket.emit('socket:error', { error: 'Failed to join room' });
      }
    });

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} - Reason: ${reason}`);
    });

    socket.on('error', (error) => {
      console.error(`🚨 Socket error for ${socket.id}:`, error);
    });
  });
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

export const sendWebsocket = (event: string, data: any, to?: string) => {
  const IO = getIO();
  try {
    const payload = {
      ...data,
      timestamp: Date.now(),
      event: event,
    };

    if (to) {
      const room = IO.sockets.adapter.rooms.get(to);
      console.log('Room:', room);
      if (room && room.size > 0) {
        IO.to(to).emit(event, payload);
        console.log(
          `📡 WebSocket event '${event}' sent to room '${to}' (${room.size} clients)`
        );
      } else {
        console.warn(
          `⚠️ No clients in room '${to}' for event '${event}'. Available rooms:`,
          Array.from(IO.sockets.adapter.rooms.keys())
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
        IO.to(to).emit('socket:error', errorPayload);
      } else {
        IO.emit('socket:error', errorPayload);
      }
    } catch (fallbackError) {
      console.error('🚨 Failed to send error notification:', fallbackError);
    }
  }
};
