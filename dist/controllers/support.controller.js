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
const email_service_1 = __importDefault(require("../services/email.service"));
const logger_1 = __importDefault(require("../utils/logger"));
class SupportController {
    constructor() {
        /**
         * Public: Submit a contact / support form (Website, Mobile, Visitors, Customers, Riders, Partners)
         */
        this.submitContactForm = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { name, email, phone, role, category, orderOrRefId, subject, message } = req.body;
            if (!name || !email || !message) {
                throw new appError_1.default('Name, email, and message are required fields.', 400);
            }
            const shortRef = 'SUP-' + Math.floor(100000 + Math.random() * 900000);
            // Save ticket record to database
            try {
                await ticket_model_1.default.create({
                    customer: req.user?._id || undefined,
                    guestName: name,
                    guestEmail: email,
                    guestPhone: phone,
                    role: role || 'user',
                    referenceCode: shortRef,
                    category: ticket_model_1.TicketCategory.OTHER,
                    subject: subject || `Support Inquiry from ${name} (${role || 'General'})`,
                    description: `Reference: ${shortRef}\nFrom: ${name} (${email}, Phone: ${phone || 'N/A'})\nRole: ${role || 'user'}\nOrder/Ref ID: ${orderOrRefId || 'N/A'}\n\nMessage:\n${message}`,
                    status: ticket_model_1.TicketStatus.OPEN,
                });
            }
            catch (dbErr) {
                logger_1.default.warn('Could not persist Ticket record, proceeding with email alert:', dbErr.message);
            }
            // 1. Dispatch notification email to GoEatOne support team
            try {
                const supportEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 14px; background: #ffffff;">
          <div style="background: #0F3D26; padding: 18px; border-radius: 10px; text-align: center; margin-bottom: 22px;">
            <h2 style="color: #FFB800; margin: 0; font-size: 20px;">New Support Inquiry (${shortRef})</h2>
          </div>
          <p style="margin: 6px 0;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 6px 0;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #0F3D26;">${email}</a></p>
          <p style="margin: 6px 0;"><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p style="margin: 6px 0;"><strong>Role:</strong> ${role || 'Visitor'}</p>
          <p style="margin: 6px 0;"><strong>Category:</strong> ${category || 'General Inquiry'}</p>
          <p style="margin: 6px 0;"><strong>Order / Ref ID:</strong> ${orderOrRefId || 'N/A'}</p>
          <p style="margin: 6px 0;"><strong>Subject:</strong> ${subject || 'General Assistance'}</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <h4 style="color: #0F3D26; margin: 0 0 10px 0;">Message Content:</h4>
          <div style="background: #f9fafb; padding: 16px; border-radius: 10px; border: 1px solid #f3f4f6; color: #374151; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${message}</div>
        </div>
      `;
                await email_service_1.default.sendEmail('support@goeatone.com', `[Support ${shortRef}] ${subject || category || 'New Inquiry'} from ${name}`, supportEmailHtml, 'default');
            }
            catch (emailErr) {
                logger_1.default.warn('Error sending support team alert email:', emailErr.message);
            }
            // 2. Dispatch acknowledgment email to user
            try {
                const userAckHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 14px; background: #ffffff;">
          <div style="background: #0F3D26; padding: 18px; border-radius: 10px; text-align: center; margin-bottom: 22px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 22px;">GoEat<span style="color: #FFB800;">One</span> Support</h2>
          </div>
          <h3 style="color: #0F3D26; margin-top: 0;">Hello ${name},</h3>
          <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
            Thank you for reaching out to us. We have successfully received your inquiry regarding <strong>"${subject || category || 'your request'}"</strong>.
          </p>
          <div style="background: #FFF9E6; border: 1px solid #FFB800; padding: 16px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0; color: #0F3D26; font-weight: bold; font-size: 15px;">Ticket Reference: ${shortRef}</p>
            <p style="margin: 6px 0 0 0; color: #78350f; font-size: 13px;">Our dedicated support team is reviewing your message and will reply directly to this email address within 24 hours.</p>
          </div>
          <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">If you have extra details, screenshots, or receipts to add, simply reply directly to this email.</p>
          <p style="color: #0F3D26; font-weight: bold; margin-top: 24px; font-size: 14px;">The GoEatOne Support Team</p>
        </div>
      `;
                await email_service_1.default.sendEmail(email, `We've received your inquiry #${shortRef} - GoEatOne Support`, userAckHtml, 'default');
            }
            catch (ackErr) {
                logger_1.default.warn('Error sending user acknowledgment email:', ackErr.message);
            }
            res.status(200).json({
                status: 'success',
                data: {
                    reference: shortRef,
                    message: 'Your message has been received! Our support team will get back to you shortly.',
                },
            });
        });
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
            }, { returnDocument: 'after' });
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
