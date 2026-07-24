import express from 'express';
import { getCart, updateCart, clearCart } from '../controllers/cart.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect); // All cart routes require authentication

router.get('/', getCart);
router.post('/update', updateCart);
router.delete('/clear', clearCart);

export default router;
