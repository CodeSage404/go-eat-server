import { Request, Response } from 'express';
import { z } from 'zod';
import orderService from '../services/order.service';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import { OrderStatus, PaymentMethod } from '../models/order.model';

const orderSchema = z.object({
  restaurant: z.string(),
  items: z.array(z.object({
    foodItem: z.string(),
    name: z.string(),
    price: z.number(),
    quantity: z.number().min(1),
  })),
  totalAmount: z.number(),
  deliveryFee: z.number(),
  deliveryAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  paymentMethod: z.nativeEnum(PaymentMethod),
});

class OrderController {
  public placeOrder = catchAsync(async (req: any, res: Response) => {
    const validatedData = orderSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    // Ensure profile is complete (must have name and email) before ordering
    if (!req.user.name || !req.user.email) {
      throw new AppError('Please complete your profile (add name and email) before placing an order.', 400);
    }

    const order = await orderService.placeOrder({
      ...req.body,
      customer: req.user._id,
    });

    res.status(201).json({
      status: 'success',
      data: { order },
    });
  });

  public updateStatus = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!Object.values(OrderStatus).includes(status)) {
      throw new AppError('Invalid order status', 400);
    }

    const order = await orderService.updateOrderStatus(
      id as string,
      status as OrderStatus,
      req.user._id,
      req.user.role
    );

    res.status(200).json({
      status: 'success',
      data: { order },
    });
  });

  public acceptDelivery = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params; // Order ID
    const riderId = req.user._id;

    const order = await orderService.assignRider(id as string, riderId);

    res.status(200).json({
      status: 'success',
      data: { order },
    });
  });

  public getMyOrders = catchAsync(async (req: any, res: Response) => {
    let orders: any[] = [];
    if (req.user.role === 'customer') {
      orders = await orderService.getCustomerOrders(req.user._id);
    } else if (req.user.role === 'vendor') {
      // Need restaurant ID for vendor
      // For now, get all orders for restaurants owned by this vendor
      throw new AppError('Use specialized vendor endpoints for orders', 400);
    } else if (req.user.role === 'rider') {
      orders = await orderService.getRiderOrders(req.user._id);
    }

    res.status(200).json({
      status: 'success',
      results: orders?.length,
      data: { orders },
    });
  });

  /**
   * Quick reorder from history
   */
  public reorder = catchAsync(async (req: any, res: Response) => {
    const { orderId } = req.params;
    const newOrder = await orderService.reorder(orderId as string, req.user._id);

    res.status(201).json({
      status: 'success',
      data: { order: newOrder },
    });
  });
}

export default new OrderController();
