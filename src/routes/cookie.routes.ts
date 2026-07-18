import { Router } from 'express';
import cookieController from '../controllers/cookie.controller';

const router = Router();

router.post('/consent', cookieController.setConsent);
router.get('/consent', cookieController.getConsent);

export default router;
