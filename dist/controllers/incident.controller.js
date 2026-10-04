"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const incident_model_1 = __importDefault(require("../models/incident.model"));
const order_model_1 = __importDefault(require("../models/order.model"));
const notification_service_1 = __importDefault(require("../services/notification.service"));
const userNotification_model_1 = require("../models/userNotification.model");
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const io_1 = require("../io");
class IncidentController {
    constructor() {
        /**
         * File a new road incident report (Courier action)
         */
        this.createIncident = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const courierId = req.user._id;
            const { orderId, issueType, issueTitle, notes, priority = 'medium' } = req.body;
            if (!issueType || !notes) {
                throw new appError_1.default('Issue type and report details are required', 400);
            }
            const title = issueTitle || issueType.replace(/_/g, ' ').toUpperCase();
            const incident = await incident_model_1.default.create({
                courier: courierId,
                order: orderId || undefined,
                issueType,
                issueTitle: title,
                notes: notes.trim(),
                priority,
                status: 'pending',
            });
            // 1. If an active order is attached, notify the customer
            if (orderId) {
                const order = await order_model_1.default.findById(orderId).populate('customer', 'name phoneNumber');
                if (order && order.customer) {
                    const customerId = order.customer._id?.toString() || order.customer.toString();
                    const shortId = order._id.toString().slice(-6).toUpperCase();
                    await notification_service_1.default.sendNotification(customerId, 'Road Incident Update ⚠️', `Your courier reported a delay for Order #${shortId}: ${title}. We are monitoring your delivery closely.`, {
                        type: 'INCIDENT_ALERT',
                        orderId: order._id.toString(),
                        incidentId: incident._id.toString(),
                        issueType,
                        issueTitle: title,
                    }, userNotification_model_1.NotificationType.ORDER_UPDATE);
                    // Real-time socket event to customer
                    (0, io_1.emitToUser)(customerId, 'order_incident_alert', {
                        orderId: order._id.toString(),
                        incidentId: incident._id.toString(),
                        issueType,
                        issueTitle: title,
                        notes: notes.trim(),
                        reportedAt: incident.createdAt,
                    });
                }
            }
            // 2. Notify the reporting courier with a confirmation push & in-app alert
            await notification_service_1.default.sendNotification(courierId.toString(), 'Incident Report Submitted 📋', `Your road report for "${title}" has been logged successfully. Dispatch operations has been alerted.`, {
                type: 'INCIDENT_CONFIRMED',
                incidentId: incident._id.toString(),
                issueType,
                issueTitle: title,
            }, userNotification_model_1.NotificationType.SYSTEM);
            res.status(201).json({
                status: 'success',
                message: 'Road incident reported successfully',
                data: { incident },
            });
        });
        /**
         * Get all road incidents for Admin Dashboard
         */
        this.getAllIncidents = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { status, priority, page = 1, limit = 50 } = req.query;
            const filter = {};
            if (status && status !== 'all') {
                filter.status = status;
            }
            if (priority && priority !== 'all') {
                filter.priority = priority;
            }
            const skip = (Number(page) - 1) * Number(limit);
            const [incidents, total] = await Promise.all([
                incident_model_1.default.find(filter)
                    .populate('courier', 'name phoneNumber email vehicleType profileImage')
                    .populate({
                    path: 'order',
                    select: '_id totalAmount status deliveryAddress customer restaurant',
                    populate: [
                        { path: 'customer', select: 'name phoneNumber' },
                        { path: 'restaurant', select: 'name address' },
                    ],
                })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(Number(limit)),
                incident_model_1.default.countDocuments(filter),
            ]);
            res.status(200).json({
                status: 'success',
                data: {
                    incidents,
                    total,
                    page: Number(page),
                    pages: Math.ceil(total / Number(limit)),
                },
            });
        });
        /**
         * Update incident review/resolved status (Admin action)
         */
        this.updateIncidentStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { status, resolutionNotes } = req.body;
            if (!['pending', 'reviewed', 'resolved'].includes(status)) {
                throw new appError_1.default('Invalid incident status', 400);
            }
            const updateData = {
                status,
                resolutionNotes: resolutionNotes ? resolutionNotes.trim() : undefined,
            };
            if (status === 'resolved') {
                updateData.resolvedAt = new Date();
                updateData.resolvedBy = req.user._id;
            }
            const incident = await incident_model_1.default.findByIdAndUpdate(id, updateData, {
                new: true,
                runValidators: true,
            })
                .populate('courier', 'name phoneNumber')
                .populate('order', '_id status');
            if (!incident) {
                throw new appError_1.default('Incident not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: `Incident marked as ${status}`,
                data: { incident },
            });
        });
    }
}
exports.default = new IncidentController();
