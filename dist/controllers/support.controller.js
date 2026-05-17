"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ticket_model_1 = __importStar(require("../models/ticket.model"));
const order_model_1 = __importDefault(require("../models/order.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
class SupportController {
    constructor() {
        /**
         * Customer: Submit a new support ticket
         */
        this.createTicket = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { orderId, category, subject, description } = req.body;
            let restaurantId;
            if (orderId) {
                const order = await order_model_1.default.findById(orderId);
                if (!order)
                    throw new appError_1.default('Order not found', 404);
                restaurantId = order.restaurant;
            }
            const ticket = await ticket_model_1.default.create({
                customer: req.user._id,
                order: orderId,
                restaurant: restaurantId,
                category,
                subject,
                description,
            });
            res.status(201).json({
                status: 'success',
                data: { ticket },
            });
        });
        /**
         * Customer: Get all their own tickets
         */
        this.getMyTickets = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const tickets = await ticket_model_1.default.find({ customer: req.user._id }).sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: tickets.length,
                data: { tickets },
            });
        });
        /**
         * Admin: Respond to and resolve a ticket
         */
        this.resolveTicket = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { adminResponse, status } = req.body;
            const ticket = await ticket_model_1.default.findByIdAndUpdate(id, {
                adminResponse,
                status: status || ticket_model_1.TicketStatus.RESOLVED,
            }, { new: true });
            if (!ticket)
                throw new appError_1.default('Ticket not found', 404);
            res.status(200).json({
                status: 'success',
                data: { ticket },
            });
        });
    }
}
exports.default = new SupportController();
