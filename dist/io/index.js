"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToUser = exports.handleSocketEvents = exports.getIO = exports.setIO = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const constants_1 = require("../types/constants");
let io;
const setIO = (ioInstance) => {
    io = ioInstance;
};
exports.setIO = setIO;
const getIO = () => io;
exports.getIO = getIO;
const handleSocketEvents = (ioInstance) => {
    (0, exports.setIO)(ioInstance);
    ioInstance.on(constants_1.SOCKET_EVENTS.CONNECT, (socket) => {
        logger_1.default.info(`🔌 New socket connection: ${socket.id}`);
        // Join a room based on user ID for targeted notifications
        socket.on(constants_1.SOCKET_EVENTS.JOIN, (userId) => {
            socket.join(userId);
            logger_1.default.info(`👤 User ${userId} joined room`);
        });
        socket.on(constants_1.SOCKET_EVENTS.DISCONNECT, () => {
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
