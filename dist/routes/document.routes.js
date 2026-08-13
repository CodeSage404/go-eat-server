"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const document_controller_1 = require("../controllers/document.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
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
router.post('/upload', document_controller_1.uploadDocument);
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
router.get('/owner/:ownerType/:ownerId', document_controller_1.getOwnerDocuments);
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
router.patch('/:id/status', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN), document_controller_1.updateDocumentStatus);
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
router.post('/check-expiry', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN), document_controller_1.checkExpiryDates);
exports.default = router;
