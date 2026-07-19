import { Router } from 'express';
import locationController from '../controllers/location.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/location/nigeria-states:
 *   get:
 *     tags:
 *       - Location
 *     summary: Get All Nigeria States
 *     description: Returns a complete list of all 36 states plus FCT Abuja in Nigeria.
 *     responses:
 *       200:
 *         description: List of Nigeria states returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     states:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get('/nigeria-states', locationController.getNigeriaStates);

/**
 * @openapi
 * /api/v1/location/autocomplete:
 *   get:
 *     tags:
 *       - Location
 *     summary: Place Autocomplete Search
 *     description: Returns place and address suggestions restricted to Nigeria as the user types.
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: The search query text (e.g. "Agbani", "Lekki")
 *     responses:
 *       200:
 *         description: Autocomplete predictions returned successfully.
 *       400:
 *         description: Missing query parameter.
 */
router.get('/autocomplete', locationController.autocomplete);

/**
 * @openapi
 * /api/v1/location/detect:
 *   get:
 *     tags:
 *       - Location
 *     summary: Detect Location via Coordinates
 *     description: Reverse-geocodes latitude and longitude coordinates into a high-precision address string.
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Geographic latitude
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Geographic longitude
 *     responses:
 *       200:
 *         description: Reverse-geocoded address returned successfully.
 *       400:
 *         description: Invalid or missing coordinates.
 */
router.get('/detect', locationController.detectLocation);

export default router;
