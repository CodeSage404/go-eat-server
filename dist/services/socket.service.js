"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToUser = exports.handleSocketEvents = exports.getIO = exports.setIO = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
let io;
const setIO = (ioInstance) => {
    io = ioInstance;
};
exports.setIO = setIO;
const getIO = () => io;
exports.getIO = getIO;
const handleSocketEvents = (ioInstance) => {
    (0, exports.setIO)(ioInstance);
    ioInstance.on('connection', (socket) => {
        logger_1.default.info(`🔌 New socket connection: ${socket.id}`);
        // Join a room based on user ID for targeted notifications
        socket.on('join', (userId) => {
            socket.join(userId);
            logger_1.default.info(`👤 User ${userId} joined room`);
        });
        socket.on('disconnect', () => {
            logger_1.default.info(`🔌 Socket disconnected: ${socket.id}`);
        });
    });
};
exports.handleSocketEvents = handleSocketEvents;
const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(userId).emit(event, data);
    }
};
exports.emitToUser = emitToUser;
