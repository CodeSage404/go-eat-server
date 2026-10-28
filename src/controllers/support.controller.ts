import { Request, Response } from 'express';
import Ticket, { TicketStatus, TicketCategory } from '../models/ticket.model';
import Order from '../models/order.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import emailService from '../services/email.service';
import logger from '../utils/logger';

class SupportController {
  /**
   * Public: Submit a contact / support form (Website, Mobile, Visitors, Customers, Riders, Partners)
   */
  public submitContactForm = catchAsync(async (req: Request, res: Response) => {
    const { name, email, phone, role, category, orderOrRefId, subject, message } = req.body;

    if (!name || !email || !message) {
      throw new AppError('Name, email, and message are required fields.', 400);
    }

    const shortRef = 'SUP-' + Math.floor(100000 + Math.random() * 900000);

    // Save ticket record to database
    try {
      await Ticket.create({
        customer: (req as any).user?._id || undefined,
        guestName: name,
        guestEmail: email,
        guestPhone: phone,
        role: role || 'user',
        referenceCode: shortRef,
        category: TicketCategory.OTHER,
        subject: subject || `Support Inquiry from ${name} (${role || 'General'})`,
        description: `Reference: ${shortRef}\nFrom: ${name} (${email}, Phone: ${phone || 'N/A'})\nRole: ${role || 'user'}\nOrder/Ref ID: ${orderOrRefId || 'N/A'}\n\nMessage:\n${message}`,
        status: TicketStatus.OPEN,
      });
    } catch (dbErr: any) {
      logger.warn('Could not persist Ticket record, proceeding with email alert:', dbErr.message);
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

      await emailService.sendEmail(
        'support@goeatone.com',
        `[Support ${shortRef}] ${subject || category || 'New Inquiry'} from ${name}`,
        supportEmailHtml,
        'default'
      );
    } catch (emailErr: any) {
      logger.warn('Error sending support team alert email:', emailErr.message);
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

      await emailService.sendEmail(
        email,
        `We've received your inquiry #${shortRef} - GoEatOne Support`,
        userAckHtml,
        'default'
      );
    } catch (ackErr: any) {
      logger.warn('Error sending user acknowledgment email:', ackErr.message);
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
  public createTicket = catchAsync(async (req: Request, res: Response) => {
    const { orderId, category, subject, description } = req.body;

    let restaurantId;
    if (orderId) {
      const order = await Order.findById(orderId);
      if (!order) throw new AppError('Order not found', 404);
      restaurantId = order.restaurant;
    }

    const ticket = await Ticket.create({
      customer: req.user!._id,
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
  public getMyTickets = catchAsync(async (req: Request, res: Response) => {
    const tickets = await Ticket.find({ customer: req.user!._id }).sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: tickets.length,
      data: { tickets },
    });
  });

  /**
   * Admin: Respond to and resolve a ticket
   */
  public resolveTicket = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { adminResponse, status } = req.body;

    const ticket = await Ticket.findByIdAndUpdate(
      id,
      {
        adminResponse,
        status: status || TicketStatus.RESOLVED,
      },
      { returnDocument: 'after' }
    );

    if (!ticket) throw new AppError('Ticket not found', 404);

    res.status(200).json({
      status: 'success',
      data: { ticket },
    });
  });
}

export default new SupportController();
