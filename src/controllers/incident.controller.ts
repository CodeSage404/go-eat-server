import { Request, Response } from 'express';
import mongoose from 'express';
import Incident from '../models/incident.model';
import Order from '../models/order.model';
import User from '../models/user.model';
import notificationService from '../services/notification.service';
import { NotificationType } from '../models/userNotification.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import { emitToUser } from '../io';

class IncidentController {
  /**
   * File a new road incident report (Courier action)
   */
  public createIncident = catchAsync(async (req: any, res: Response) => {
    const courierId = req.user._id;
    const { orderId, issueType, issueTitle, notes, priority = 'medium' } = req.body;

    if (!issueType || !notes) {
      throw new AppError('Issue type and report details are required', 400);
    }

    const title = issueTitle || issueType.replace(/_/g, ' ').toUpperCase();

    const incident = await Incident.create({
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
      const order = await Order.findById(orderId).populate('customer', 'name phoneNumber');
      if (order && order.customer) {
        const customerId = (order.customer as any)._id?.toString() || order.customer.toString();
        const shortId = order._id.toString().slice(-6).toUpperCase();

        await notificationService.sendNotification(
          customerId,
          'Road Incident Update ⚠️',
          `Your courier reported a delay for Order #${shortId}: ${title}. We are monitoring your delivery closely.`,
          {
            type: 'INCIDENT_ALERT',
            orderId: order._id.toString(),
            incidentId: incident._id.toString(),
            issueType,
            issueTitle: title,
          },
          NotificationType.ORDER_UPDATE
        );

        // Real-time socket event to customer
        emitToUser(customerId, 'order_incident_alert', {
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
    await notificationService.sendNotification(
      courierId.toString(),
      'Incident Report Submitted 📋',
      `Your road report for "${title}" has been logged successfully. Dispatch operations has been alerted.`,
      {
        type: 'INCIDENT_CONFIRMED',
        incidentId: incident._id.toString(),
        issueType,
        issueTitle: title,
      },
      NotificationType.SYSTEM
    );

    res.status(201).json({
      status: 'success',
      message: 'Road incident reported successfully',
      data: { incident },
    });
  });

  /**
   * Get all road incidents for Admin Dashboard
   */
  public getAllIncidents = catchAsync(async (req: Request, res: Response) => {
    const { status, priority, page = 1, limit = 50 } = req.query as any;

    const filter: any = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (priority && priority !== 'all') {
      filter.priority = priority;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [incidents, total] = await Promise.all([
      Incident.find(filter)
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
      Incident.countDocuments(filter),
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
  public updateIncidentStatus = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;

    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      throw new AppError('Invalid incident status', 400);
    }

    const updateData: any = {
      status,
      resolutionNotes: resolutionNotes ? resolutionNotes.trim() : undefined,
    };

    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = req.user._id;
    }

    const incident = await Incident.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('courier', 'name phoneNumber')
      .populate('order', '_id status');

    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    res.status(200).json({
      status: 'success',
      message: `Incident marked as ${status}`,
      data: { incident },
    });
  });
}

export default new IncidentController();
