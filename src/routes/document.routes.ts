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

/**
 * @openapi
 * /api/v1/documents/upload:
 *   post:
 *     tags:
 *       - Documents
 *     summary: Upload a new document
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 */
router.post('/upload', uploadDocument);

/**
 * @openapi
 * /api/v1/documents/owner/{ownerType}/{ownerId}:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Get documents by owner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ownerType
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: ownerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of documents
 */
router.get('/owner/:ownerType/:ownerId', getOwnerDocuments);

/**
 * @openapi
 * /api/v1/documents/{id}/status:
 *   patch:
 *     tags:
 *       - Documents
 *     summary: Update document status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/:id/status', restrictTo(UserRole.ADMIN), updateDocumentStatus);

/**
 * @openapi
 * /api/v1/documents/check-expiry:
 *   post:
 *     tags:
 *       - Documents
 *     summary: Check for expired documents
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expiry check completed
 */
router.post('/check-expiry', restrictTo(UserRole.ADMIN), checkExpiryDates);

export default router;
