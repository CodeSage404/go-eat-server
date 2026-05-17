import { Request, Response } from 'express';
import Ticket, { TicketStatus } from '../models/ticket.model';
import Order from '../models/order.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

class SupportController {
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
      { new: true }
    );

    if (!ticket) throw new AppError('Ticket not found', 404);

    res.status(200).json({
      status: 'success',
      data: { ticket },
    });
  });
}

export default new SupportController();
