import { Request, Response } from 'express';
import Cart from '../models/cart.model';
import { AuthRequest } from '../middleware/auth.middleware';
import mongoose from 'mongoose';

export const getCart = async (req: AuthRequest, res: Response) => {
  try {
    const cart = await Cart.findOne({ user: req.user?._id })
      .populate('items.menuItemId')
      .populate('restaurant');
      
    if (!cart) {
      return res.status(200).json({ success: true, data: null });
    }
    
    res.status(200).json({ success: true, data: cart });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCart = async (req: AuthRequest, res: Response) => {
  try {
    const { restaurantId, items } = req.body;
    
    if (!items || items.length === 0) {
      await Cart.findOneAndDelete({ user: req.user?._id });
      return res.status(200).json({ success: true, data: null });
    }
    
    const cart = await Cart.findOneAndUpdate(
      { user: req.user?._id },
      { 
        user: req.user?._id,
        restaurant: restaurantId,
        items: items
      },
      { new: true, upsert: true }
    )
    .populate('items.menuItemId')
    .populate('restaurant');
    
    res.status(200).json({ success: true, data: cart });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const clearCart = async (req: AuthRequest, res: Response) => {
  try {
    await Cart.findOneAndDelete({ user: req.user?._id });
    res.status(200).json({ success: true, data: null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
