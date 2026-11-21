"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const catalogImport_controller_1 = require("../controllers/catalogImport.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
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
router.post('/:restaurantId/import', auth_middleware_1.protect, catalogImport_controller_1.CatalogImportController.importCatalog);
exports.default = router;
