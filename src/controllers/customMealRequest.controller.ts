import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import CustomMealRequest from '../models/customMealRequest.model';
import Restaurant from '../models/restaurant.model';
import Order, { OrderStatus, PaymentMethod } from '../models/order.model';
import { UserRole } from '../models/user.model';

class CustomMealRequestController {
  /**
   * Customer creates a new custom request for a Signature Chef
   */
  public createRequest = catchAsync(async (req: any, res: Response) => {
    const { restaurantId, requestText, photos, specialNotes } = req.body;

    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
      throw new AppError('Valid restaurant ID is required', 400);
    }
    if (!requestText || String(requestText).trim().length === 0) {
      throw new AppError('Request details are required', 400);
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      throw new AppError('Chef / Restaurant not found', 404);
    }

    let photoUrls: string[] = [];
    if (Array.isArray(photos)) {
      photoUrls = photos;
    } else if (req.files && Array.isArray(req.files)) {
      photoUrls = req.files.map((f: any) => f.path);
    }

    const request = await CustomMealRequest.create({
      customer: req.user._id,
      restaurant: restaurantId,
      requestText: String(requestText).trim(),
      photos: photoUrls,
      specialNotes: specialNotes ? String(specialNotes).trim() : '',
      status: 'pending',
    });

    await request.populate('restaurant', 'name images outletType address');

    res.status(201).json({
      status: 'success',
      data: { request },
    });
  });

  /**
   * Get custom requests list (filtered by role: Vendor, Customer, or Admin)
   */
  public getRequests = catchAsync(async (req: any, res: Response) => {
    const { status, restaurantId } = req.query;
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (req.user.role === UserRole.VENDOR) {
      const vendorRest = await Restaurant.findOne({ owner: req.user._id });
      if (!vendorRest) {
        return res.status(200).json({ status: 'success', data: { requests: [] } });
      }
      filter.restaurant = vendorRest._id;
    } else if (req.user.role === UserRole.CUSTOMER) {
      filter.customer = req.user._id;
    } else if (req.user.role === UserRole.ADMIN) {
      if (restaurantId && mongoose.Types.ObjectId.isValid(restaurantId as string)) {
        filter.restaurant = restaurantId;
      }
    }

    const requests = await CustomMealRequest.find(filter)
      .populate('customer', 'name email phone avatar')
      .populate('restaurant', 'name images outletType address')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: requests.length,
      data: { requests },
    });
  });

  /**
   * Get single custom request by ID
   */
  public getRequestById = catchAsync(async (req: any, res: Response) => {
    const request = await CustomMealRequest.findById(req.params.id)
      .populate('customer', 'name email phone avatar')
      .populate('restaurant', 'name images outletType address');

    if (!request) {
      throw new AppError('Custom request not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { request },
    });
  });

  /**
   * Chef sends itemized quote to customer
   */
  public sendQuote = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    const { itemName, price, deliveryFee, chefMessage } = req.body;

    const request = await CustomMealRequest.findById(id);
    if (!request) {
      throw new AppError('Custom request not found', 404);
    }

    // Verify vendor ownership
    if (req.user.role === UserRole.VENDOR) {
      const vendorRest = await Restaurant.findOne({ owner: req.user._id });
      if (!vendorRest || vendorRest._id.toString() !== request.restaurant.toString()) {
        throw new AppError('You do not have permission to quote this request', 403);
      }
    }

    const mealPrice = Number(price);
    const mealDeliveryFee = Number(deliveryFee) || 0;
    if (isNaN(mealPrice) || mealPrice <= 0) {
      throw new AppError('Please provide a valid price for the custom meal', 400);
    }

    request.quote = {
      itemName: itemName ? String(itemName).trim() : 'Custom Chef Special',
      price: mealPrice,
      deliveryFee: mealDeliveryFee,
      total: mealPrice + mealDeliveryFee,
      chefMessage: chefMessage ? String(chefMessage).trim() : '',
      quotedAt: new Date(),
    };
    request.status = 'priced';

    await request.save();
    await request.populate('customer', 'name email phone avatar');

    res.status(200).json({
      status: 'success',
      data: { request },
    });
  });

  /**
   * Customer accepts quote and converts into an Order
   */
  public acceptQuote = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    const { deliveryAddress, paymentMethod, deliveryNotes } = req.body;

    const request = await CustomMealRequest.findById(id);
    if (!request) {
      throw new AppError('Custom request not found', 404);
    }

    if (request.customer.toString() !== req.user._id.toString()) {
      throw new AppError('You do not have permission to accept this quote', 403);
    }

    if (request.status !== 'priced' || !request.quote) {
      throw new AppError('This request has not received an active quote yet', 400);
    }

    const restaurant = await Restaurant.findById(request.restaurant);
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    const quote = request.quote;
    const grossAmount = quote.price;
    const deliveryFee = quote.deliveryFee;
    const totalAmount = quote.total;

    // Create order directly from custom quote
    const order = await Order.create({
      customer: req.user._id,
      restaurant: restaurant._id,
      items: [
        {
          name: quote.itemName,
          price: quote.price,
          quantity: 1,
          notes: request.requestText + (request.specialNotes ? ` | Note: ${request.specialNotes}` : ''),
        },
      ],
      grossAmount,
      deliveryFee,
      totalAmount,
      deliveryAddress: deliveryAddress || {
        street: 'Delivery Address',
        city: restaurant.address.city,
        state: restaurant.address.state,
        zipCode: '100001',
      },
      paymentMethod: paymentMethod || PaymentMethod.CARD,
      deliveryNotes: deliveryNotes || request.specialNotes || '',
      status: OrderStatus.ACCEPTED,
    });

    request.status = 'accepted';
    request.order = order._id;
    await request.save();

    res.status(200).json({
      status: 'success',
      data: {
        request,
        order,
      },
    });
  });

  /**
   * Update request status (e.g. Reject / Cancel / Complete)
   */
  public updateStatus = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'priced', 'accepted', 'rejected', 'completed', 'cancelled'].includes(status)) {
      throw new AppError('Invalid status value', 400);
    }

    const request = await CustomMealRequest.findById(id);
    if (!request) {
      throw new AppError('Custom request not found', 404);
    }

    request.status = status;
    await request.save();

    res.status(200).json({
      status: 'success',
      data: { request },
    });
  });
}

export default new CustomMealRequestController();
