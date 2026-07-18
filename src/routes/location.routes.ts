import { Router } from 'express';
import locationController from '../controllers/location.controller';

const router = Router();

router.get('/nigeria-states', locationController.getNigeriaStates);
router.get('/autocomplete', locationController.autocomplete);
router.get('/detect', locationController.detectLocation);

export default router;
