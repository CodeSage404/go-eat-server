"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const legalDocument_controller_1 = require("../controllers/legalDocument.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /api/v1/legal-documents:
 *   get:
 *     tags:
 *       - Legal & Compliance
 *     summary: List all legal documents with optional filters
 *     description: Returns legal documents filtered by country, targetRole, or documentType.
 *     parameters:
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *           enum: [NG, UK, IT, ALL]
 *         description: Country code filter
 *       - in: query
 *         name: targetRole
 *         schema:
 *           type: string
 *           enum: [users, riders, partners, all]
 *         description: Target role filter
 *       - in: query
 *         name: documentType
 *         schema:
 *           type: string
 *         description: Document type filter
 *     responses:
 *       200:
 *         description: Successfully retrieved list of legal documents.
 *       500:
 *         description: Server error.
 */
router.get('/', legalDocument_controller_1.LegalDocumentController.listDocuments);
/**
 * @openapi
 * /api/v1/legal-documents/pending-acceptance:
 *   get:
 *     tags:
 *       - Legal & Compliance
 *     summary: Check pending legal terms for authenticated user
 *     description: Returns any mandatory terms/policies that the user has not accepted yet or that have expired (> 6 months).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Returns pending terms state.
 *       401:
 *         description: Unauthorized.
 */
router.get('/pending-acceptance', auth_middleware_1.protect, legalDocument_controller_1.LegalDocumentController.getPendingAcceptances);
/**
 * @openapi
 * /api/v1/legal-documents/accept:
 *   post:
 *     tags:
 *       - Legal & Compliance
 *     summary: Accept updated terms or policies
 *     description: Logs an acceptance record for the user, sends in-app notification, and dispatches confirmation email.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [documentType]
 *             properties:
 *               documentType:
 *                 type: string
 *                 enum: [privacy_policy, cookies_policy, fees_charges_commissions, cancellation_return_policy, seller_terms_conditions, buyer_terms_fair_use]
 *               country:
 *                 type: string
 *                 example: NG
 *     responses:
 *       200:
 *         description: Acceptance logged and confirmation dispatched.
 *       400:
 *         description: Missing documentType.
 *       401:
 *         description: Unauthorized.
 */
router.post('/accept', auth_middleware_1.protect, legalDocument_controller_1.LegalDocumentController.acceptDocument);
/**
 * @openapi
 * /api/v1/legal-documents/acceptances-log:
 *   get:
 *     tags:
 *       - Legal & Compliance
 *     summary: Admin compliance audit register of accepted terms
 *     description: Paginated audit trail of all users, riders, and partners who have accepted terms, including timestamp and IP.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *       - in: query
 *         name: userRole
 *         schema:
 *           type: string
 *       - in: query
 *         name: documentType
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully retrieved compliance audit register.
 *       403:
 *         description: Forbidden - Admin only.
 */
router.get('/acceptances-log', auth_middleware_1.protect, (0, auth_middleware_1.restrictTo)('admin', 'superadmin'), legalDocument_controller_1.LegalDocumentController.getAcceptancesAuditLog);
/**
 * @openapi
 * /api/v1/legal-documents/publish:
 *   post:
 *     tags:
 *       - Legal & Compliance
 *     summary: Admin publish or update a legal document
 *     description: Creates or updates a legal document with country and role specificity, generating a new version.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [documentType, title, content]
 *             properties:
 *               documentType:
 *                 type: string
 *               targetRole:
 *                 type: string
 *                 enum: [users, riders, partners, all]
 *               country:
 *                 type: string
 *                 enum: [NG, UK, IT, ALL]
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               version:
 *                 type: string
 *               summaryOfChanges:
 *                 type: string
 *               isPublished:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Document published successfully.
 *       400:
 *         description: Missing required fields.
 *       403:
 *         description: Forbidden - Admin only.
 */
router.post('/publish', auth_middleware_1.protect, (0, auth_middleware_1.restrictTo)('admin', 'superadmin'), legalDocument_controller_1.LegalDocumentController.publishDocument);
/**
 * @openapi
 * /api/v1/legal-documents/{type}:
 *   get:
 *     tags:
 *       - Legal & Compliance
 *     summary: Get single active document by type
 *     description: Retrieves the active published version of a legal document for a specific country and role.
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Document type
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *           default: NG
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           default: users
 *     responses:
 *       200:
 *         description: Document retrieved successfully.
 *       404:
 *         description: Document not found.
 */
router.get('/:type', legalDocument_controller_1.LegalDocumentController.getDocument);
exports.default = router;
