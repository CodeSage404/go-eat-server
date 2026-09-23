"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const voice_service_1 = __importDefault(require("../services/voice.service"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
class VoiceController {
    constructor() {
        /**
         * Issue Twilio Voice Access Token for in-app VoIP calling
         */
        this.getToken = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { orderId, role, platform } = req.body;
            if (!orderId) {
                throw new appError_1.default('orderId is required', 400);
            }
            const userId = req.user._id.toString();
            const tokenData = await voice_service_1.default.generateVoiceToken(userId, orderId, role || 'customer', (platform || 'ios'));
            res.status(200).json({
                status: 'success',
                data: tokenData,
            });
        });
        /**
         * Handle incoming TwiML request from Twilio Voice SDK
         */
        this.handleTwiml = (req, res) => {
            const to = (req.body.To || req.query.To || '');
            const callerName = (req.body.callerName || req.query.callerName || '');
            const orderId = (req.body.orderId || req.query.orderId || '');
            const twiml = voice_service_1.default.generateCallTwiml(to, callerName, orderId);
            res.type('text/xml');
            res.send(twiml);
        };
        /**
         * Initiate masked cellular call bridge between customer and courier
         */
        this.initiateMaskedBridge = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { orderId } = req.body;
            if (!orderId) {
                throw new appError_1.default('orderId is required', 400);
            }
            const userId = req.user._id.toString();
            const result = await voice_service_1.default.initiateMaskedBridgeCall(orderId, userId);
            res.status(200).json({
                status: 'success',
                data: result,
            });
        });
    }
}
exports.default = new VoiceController();
