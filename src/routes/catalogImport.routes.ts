import { Router } from 'express';
import { CatalogImportController } from '../controllers/catalogImport.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/catalog/{restaurantId}/import:
 *   post:
 *     summary: Import or update restaurant items via Universal CSV
 *     description: Parses CSV matching GoEatOne Universal Catalog schema and idempotently updates restaurant products
 *     tags:
 *       - Catalog
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - csvContent
 *             properties:
 *               csvContent:
 *                 type: string
 *     responses:
 *       200:
 *         description: Catalog import processed successfully
 *       400:
 *         description: Invalid CSV data or missing required fields
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:restaurantId/import', protect, CatalogImportController.importCatalog);

export default router;
