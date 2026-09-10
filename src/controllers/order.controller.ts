import { Request, Response } from 'express';
import { z } from 'zod';
import orderService from '../services/order.service';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import { OrderStatus, PaymentMethod } from '../models/order.model';
import Restaurant from '../models/restaurant.model';
import Setting from '../models/setting.model';
import emailService from '../services/email.service';

const orderSchema = z.object({
  restaurant: z.string(),
  items: z.array(z.object({
    foodItem: z.string(),
    name: z.string().optional().default('Food Item'),
    price: z.number().optional().default(0),
    quantity: z.number().min(1).optional().default(1),
    image: z.string().optional(),
    selectedAddons: z.any().optional(),
  })),
  totalAmount: z.number().optional().default(0),
  deliveryFee: z.number().optional().default(0),
  deliveryAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    coordinates: z.tuple([z.number(), z.number()]).optional(),
    address: z.string().optional(),
    building: z.string().optional(),
    landmark: z.string().optional(),
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
      street: rawAddress.street || rawAddress.address || 'Address',
      city: rawAddress.city || '',
      state: rawAddress.state || '',
      zipCode: rawAddress.zipCode || '',
      coordinates: rawAddress.coordinates,
      address: rawAddress.address || rawAddress.street || '',
      building: rawAddress.building || '',
      landmark: rawAddress.landmark || '',
    };

    const normalizedItems = (body.items || []).map((item: any) => ({
      foodItem: item.foodItem || item._id,
      name: item.name || 'Food Item',
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
      image: item.image || item.foodItem?.image || '',
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

    await order.populate('items.foodItem');

    // Send emails immediately only for CASH orders.
    // For CARD orders, emails are sent after successful payment verification.
    if (order.paymentMethod === PaymentMethod.CASH) {
      if (req.user.email && !req.user.email.includes('customer@goeat.com')) {
        emailService.sendTemplateEmail(
          req.user.email,
          'ORDER_CONFIRMED',
          `Order Confirmed: #${order._id.toString().slice(-6).toUpperCase()}`,
          { 
            orderId: order._id, 
            customerName: req.user.name, 
            total: order.totalAmount,
            items: order.items 
          }
        ).catch((err: any) => console.error('Failed to send order email:', err));
      }

      const restaurant = await Restaurant.findById(order.restaurant).populate<{ owner: { email: string; name: string } }>('owner');
      const vendorEmail = restaurant?.businessEmail || restaurant?.owner?.email;

      if (vendorEmail) {
        emailService.sendTemplateEmail(
          vendorEmail,
          'VENDOR_ORDER_RECEIVED',
          `New Order Received: #${order._id.toString().slice(-6).toUpperCase()}`,
          {
            orderId: order._id,
            outletName: restaurant?.name || 'Partner',
            customerName: req.user.name || 'Customer',
            total: order.totalAmount,
            items: order.items,
          },
          'partners'
        ).catch((err: any) => console.error('Failed to send vendor order email:', err));
      }
    }

    res.status(201).json({
      status: 'success',
      data: { order },
    });
  });

  public updateStatus = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    const { status, cancelReason, estimatedPrepTime } = req.body;

    if (!Object.values(OrderStatus).includes(status)) {
      throw new AppError('Invalid order status', 400);
    }

    const order = await orderService.updateOrderStatus(
      id as string,
      status as OrderStatus,
      req.user._id,
      req.user.role,
      cancelReason,
      estimatedPrepTime ? Number(estimatedPrepTime) : undefined
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

  public getAvailableJobs = catchAsync(async (_req: any, res: Response) => {
    const orders = await orderService.getAvailableDeliveryJobs();
    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: { orders },
    });
  });

  public getMyOrders = catchAsync(async (req: any, res: Response) => {
    let orders: any[] = [];
    if (req.user.role === 'customer') {
      orders = await orderService.getCustomerOrders(req.user._id);
    } else if (req.user.role === 'vendor') {
      const restaurant = await Restaurant.findOne({ owner: req.user._id });
      if (!restaurant) {
        throw new AppError('No restaurant found for this vendor', 404);
      }
      orders = await orderService.getRestaurantOrders(restaurant._id.toString());
      orders = orders.map((ord: any) => {
        const obj = ord.toObject ? ord.toObject() : { ...ord };
        delete obj.deliveryPin;
        return obj;
      });
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

    const orderObj = (order as any).toObject ? (order as any).toObject() : { ...order };
    if (req.user.role === 'vendor') {
      delete orderObj.deliveryPin;
    }

    res.status(200).json({
      status: 'success',
      data: { order: orderObj },
    });
  });

  /**
   * Quick reorder from history
   */
  public reorder = catchAsync(async (req: any, res: Response) => {
    const { orderId, id } = req.params;
    const targetId = orderId || id;
    const newOrder = await orderService.reorder(targetId as string, req.user._id);

    res.status(201).json({
      status: 'success',
      data: { order: newOrder },
    });
  });

  /**
   * Verify delivery PIN from customer and mark order as delivered
   */
  public verifyDeliveryPin = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    const pinSchema = z.object({
      pin: z.string().min(4, 'Delivery PIN must be at least 4 digits').max(6, 'Delivery PIN is maximum 6 digits'),
    });

    const validated = pinSchema.safeParse(req.body);
    if (!validated.success) {
      throw new AppError(validated.error.issues.map((i) => i.message).join(', '), 400);
    }

    const order = await orderService.verifyDeliveryPin(
      id,
      validated.data.pin,
      req.user._id.toString(),
      req.user.role
    );

    res.status(200).json({
      status: 'success',
      message: 'Delivery verified successfully',
      data: { order },
    });
  });

  /**
   * Calculate dynamic checkout fees (delivery fee, service fee, small order fee)
   */
  public quoteFees = catchAsync(async (req: Request, res: Response) => {
    const { outlets, deliveryCoordinates, deliveryAddressText, isPickup } = req.body;
    if (!outlets || !Array.isArray(outlets) || outlets.length === 0) {
      throw new AppError('Outlets array is required for fee quotation', 400);
    }

    const quote = await orderService.quoteCheckoutFees({
      outlets,
      deliveryCoordinates,
      deliveryAddressText,
      isPickup: Boolean(isPickup),
    });

    res.status(200).json({
      status: 'success',
      data: quote,
    });
  });

  /**
   * Place multi-outlet checkout order(s) (Batched Pickup vs Split Delivery)
   */
  public placeMultiOutletOrder = catchAsync(async (req: any, res: Response) => {
    const body = req.body || {};
    const { subOrders, deliveryAddress, paymentMethod, deliveryMode, deliveryTime, deliveryNotes, tipAmount, orderType } = body;

    if (!subOrders || !Array.isArray(subOrders) || subOrders.length === 0) {
      throw new AppError('subOrders array is required for multi-outlet checkout', 400);
    }

    const result = await orderService.processMultiOutletCheckout({
      customerId: req.user._id,
      subOrders,
      deliveryAddress,
      paymentMethod: paymentMethod || PaymentMethod.CARD,
      deliveryMode,
      deliveryTime,
      deliveryNotes,
      tipAmount: Number(tipAmount) || 0,
      orderType,
    });

    res.status(201).json({
      status: 'success',
      data: result,
    });
  });

  /**
   * Get public platform fee configuration (delivery base fee, rate per km, service fee)
   */
  public getPublicFees = catchAsync(async (req: Request, res: Response) => {
    const setting = await Setting.findOne();
    res.status(200).json({
      status: 'success',
      data: {
        deliveryBaseFee: setting?.deliveryBaseFee ?? 500,
        deliveryFeePerKm: setting?.deliveryFeePerKm ?? 100,
        serviceFee: setting?.serviceFee ?? 170,
        smallOrderFee: setting?.smallOrderFee ?? 150,
        smallOrderFeeThreshold: setting?.smallOrderFeeThreshold ?? 1000,
        batchPickupThresholdKm: setting?.batchPickupThresholdKm ?? 3.0,
        multiOutletExtraStopFee: setting?.multiOutletExtraStopFee ?? 300,
        maxDeliveryDistance: setting?.maxDeliveryDistance ?? 15,
      },
    });
  });
}

export default new OrderController();
