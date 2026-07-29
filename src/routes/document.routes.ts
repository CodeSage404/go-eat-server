import { Router } from 'express';
import {
  uploadDocument,
  getOwnerDocuments,
  updateDocumentStatus,
  checkExpiryDates,
} from '../controllers/document.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

router.use(protect);

router.post('/upload', uploadDocument);
router.get('/owner/:ownerType/:ownerId', getOwnerDocuments);
router.patch('/:id/status', restrictTo(UserRole.ADMIN), updateDocumentStatus);
router.post('/check-expiry', restrictTo(UserRole.ADMIN), checkExpiryDates);

export default router;
