import { Request, Response } from 'express';
import { z } from 'zod';
import orderService from '../services/order.service';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import { OrderStatus, PaymentMethod } from '../models/order.model';
import emailService from '../services/email.service';

const orderSchema = z.object({
  restaurant: z.string(),
  items: z.array(z.object({
    foodItem: z.string(),
    name: z.string().optional().default('Food Item'),
    price: z.number().optional().default(0),
    quantity: z.number().min(1).optional().default(1),
    selectedAddons: z.any().optional(),
  })),
  totalAmount: z.number().optional().default(0),
  deliveryFee: z.number().optional().default(0),
  deliveryAddress: z.object({
    street: z.string().optional().default('Default Street'),
    city: z.string().optional().default('Lagos'),
    state: z.string().optional().default('Lagos'),
    zipCode: z.string().optional().default('100001'),
    coordinates: z.tuple([z.number(), z.number()]).optional().default([3.3792, 6.5244]),
    address: z.string().optional(),
  }),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().default(PaymentMethod.CARD),
  deliveryMode: z.string().optional(),
  deliveryTime: z.string().optional(),
  deliveryNotes: z.string().optional(),
});

class OrderController {
  public placeOrder = catchAsync(async (req: any, res: Response) => {
    const body = req.body || {};
    const rawAddress = body.deliveryAddress || {};
    const normalizedAddress = {
      street: rawAddress.street || rawAddress.address || 'Default Street',
      city: rawAddress.city || 'Lagos',
      state: rawAddress.state || 'Lagos',
      zipCode: rawAddress.zipCode || '100001',
      coordinates: rawAddress.coordinates || [3.3792, 6.5244],
      address: rawAddress.address || rawAddress.street || 'Default Street',
    };

    const normalizedItems = (body.items || []).map((item: any) => ({
      foodItem: item.foodItem || item._id,
      name: item.name || 'Food Item',
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
      selectedAddons: item.selectedAddons || [],
    }));

    const normalizedBody = {
      ...body,
      items: normalizedItems,
      totalAmount: Number(body.totalAmount) || 0,
      deliveryFee: Number(body.deliveryFee) || 0,
      deliveryAddress: normalizedAddress,
      paymentMethod: body.paymentMethod || PaymentMethod.CARD,
    };

    const validatedData = orderSchema.safeParse(normalizedBody);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    if (!req.user.name) {
      req.user.name = 'Customer';
    }
    if (!req.user.email) {
      req.user.email = `${req.user.phoneNumber || 'customer'}@goeat.com`;
    }

    const order = await orderService.placeOrder({
      ...normalizedBody,
      customer: req.user._id,
    });

    if (req.user.email && !req.user.email.includes('customer@goeat.com')) {
      emailService.sendTemplateEmail(
        req.user.email,
        'ORDER_CONFIRMED',
        `Order Confirmed: #${order._id.toString().slice(-6).toUpperCase()}`,
        { orderId: order._id, customerName: req.user.name, total: order.totalAmount }
      ).catch(err => console.error('Failed to send order email:', err));
    }

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

  public getOrderById = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    const order = await orderService.getOrderById(id);
    
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { order },
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
