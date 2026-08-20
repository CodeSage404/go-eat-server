import { Response } from 'express';
import Cart from '../models/cart.model';
import { AuthRequest } from '../middleware/auth.middleware';

export const getCart = async (req: AuthRequest, res: Response) => {
  try {
    const cart = await Cart.findOne({ user: req.user?._id })
      .populate('items.menuItemId')
      .populate('items.restaurant')
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

    const formattedItems = (items || []).map((item: any) => ({
      menuItemId: item.cartItemId ? (item._id || item.cartItemId.split('_')[0]) : (item._id || item.menuItemId),
      restaurant: item.restaurantId || restaurantId,
      quantity: item.quantity || 1,
    }));
    
    const cart = await Cart.findOneAndUpdate(
      { user: req.user?._id },
      { 
        user: req.user?._id,
        restaurant: restaurantId || formattedItems[0]?.restaurant,
        items: formattedItems
      },
      { new: true, upsert: true }
    )
    .populate('items.menuItemId')
    .populate('items.restaurant')
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
