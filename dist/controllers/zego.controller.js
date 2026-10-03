"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zego_service_1 = __importDefault(require("../services/zego.service"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
class ZegoController {
    constructor() {
        /**
         * Issue ZEGOCLOUD token04 and room credentials for in-app VoIP calling
         */
        this.getToken = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { orderId, role, target } = req.body;
            const userId = req.user._id.toString();
            const data = await zego_service_1.default.generateCallToken(userId, orderId || undefined, role || req.user.role || 'customer', target || 'customer');
            res.status(200).json({
                status: 'success',
                data,
            });
        });
        /**
         * Notify call recipient when an outgoing call is placed
         */
        this.notifyRecipient = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { orderId, role, target } = req.body;
            if (!orderId) {
                throw new appError_1.default('orderId is required', 400);
            }
            const userId = req.user._id.toString();
            await zego_service_1.default.notifyCallRecipient(userId, orderId, role || req.user.role || 'customer', target || 'customer');
            res.status(200).json({
                status: 'success',
                message: 'Recipient notified',
            });
        });
        /**
         * Notify other party when a call is ended
         */
        this.endCall = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { orderId, role, target } = req.body;
            if (!orderId) {
                throw new appError_1.default('orderId is required', 400);
            }
            const userId = req.user._id.toString();
            await zego_service_1.default.notifyCallEnded(userId, orderId, role || req.user.role || 'customer', target || 'customer');
            res.status(200).json({
                status: 'success',
                message: 'Call ended notification sent',
            });
        });
    }
}
exports.default = new ZegoController();
