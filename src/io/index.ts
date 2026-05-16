import { Server } from 'socket.io';
import logger from '../utils/logger';
import { SOCKET_EVENTS } from '../types/constants';

let io: Server;

export const setIO = (ioInstance: Server) => {
  io = ioInstance;
};

export const getIO = () => io;

export const handleSocketEvents = (ioInstance: Server) => {
  setIO(ioInstance);
  
  ioInstance.on(SOCKET_EVENTS.CONNECT, (socket) => {
    logger.info(`🔌 New socket connection: ${socket.id}`);

    // Join a room based on user ID for targeted notifications
    socket.on(SOCKET_EVENTS.JOIN, (userId: string) => {
      socket.join(userId);
      logger.info(`👤 User ${userId} joined room`);
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      logger.info(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(userId).emit(event, data);
  }
};
