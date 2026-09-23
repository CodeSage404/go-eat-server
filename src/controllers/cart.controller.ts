import { Response } from 'express';
import mongoose from 'mongoose';
import Cart from '../models/cart.model';
import { AuthRequest } from '../middleware/auth.middleware';

export const getCart = async (req: AuthRequest, res: Response) => {
  try {
    const cart = await Cart.findOne({ user: req.user?._id })
      .populate('items.menuItemId')
      .populate('items.restaurant')
      .populate('restaurant');
      
    if (!cart) {
      return res.status(200).json({ status: 'success', success: true, data: null });
    }
    
    res.status(200).json({ status: 'success', success: true, data: cart });
  } catch (error: any) {
    res.status(500).json({ status: 'error', success: false, message: error.message });
  }
};

export const updateCart = async (req: AuthRequest, res: Response) => {
  try {
    const { restaurantId, items } = req.body;
    
    if (!items || items.length === 0) {
      await Cart.findOneAndDelete({ user: req.user?._id });
      return res.status(200).json({ status: 'success', success: true, data: null });
    }

    const formattedItems = (items || [])
      .map((item: any) => {
        let rawMenuId = item.cartItemId ? (item._id || item.cartItemId.split('_')[0]) : (item._id || item.menuItemId);
        if (typeof rawMenuId === 'object' && rawMenuId?._id) rawMenuId = rawMenuId._id;
        const validMenuId = rawMenuId && mongoose.isValidObjectId(rawMenuId) ? rawMenuId : null;

        let rawRestId = item.restaurantId || restaurantId;
        if (typeof rawRestId === 'object' && rawRestId?._id) rawRestId = rawRestId._id;
        const validRestId = rawRestId && mongoose.isValidObjectId(rawRestId) ? rawRestId : undefined;

        return {
          menuItemId: validMenuId,
          restaurant: validRestId,
          quantity: item.quantity && Number(item.quantity) > 0 ? Number(item.quantity) : 1,
        };
      })
      .filter((item: any) => item.menuItemId !== null);

    const validRest = restaurantId && mongoose.isValidObjectId(restaurantId) 
      ? restaurantId 
      : formattedItems[0]?.restaurant;
    
    const cart = await Cart.findOneAndUpdate(
      { user: req.user?._id },
      { 
        user: req.user?._id,
        restaurant: validRest,
        items: formattedItems
      },
      { returnDocument: 'after', upsert: true }
    )
    .populate('items.menuItemId')
    .populate('items.restaurant')
    .populate('restaurant');
    
    res.status(200).json({ status: 'success', success: true, data: cart });
  } catch (error: any) {
    res.status(500).json({ status: 'error', success: false, message: error.message });
  }
};

export const clearCart = async (req: AuthRequest, res: Response) => {
  try {
    await Cart.findOneAndDelete({ user: req.user?._id });
    res.status(200).json({ status: 'success', success: true, data: null });
  } catch (error: any) {
    res.status(500).json({ status: 'error', success: false, message: error.message });
  }
};
