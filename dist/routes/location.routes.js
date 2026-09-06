"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const location_controller_1 = __importDefault(require("../controllers/location.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
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
router.get('/nigeria-states', location_controller_1.default.getNigeriaStates);
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
router.get('/autocomplete', location_controller_1.default.autocomplete);
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
 *         description: Reverse-geocoded address and regional country detection flags returned successfully.
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
 *                     address:
 *                       type: string
 *                       example: "Via Roma, Milan, Italy"
 *                     country:
 *                       type: string
 *                       example: "Italy"
 *                     countryCode:
 *                       type: string
 *                       example: "IT"
 *                     isNigeria:
 *                       type: boolean
 *                       example: false
 *                     isItaly:
 *                       type: boolean
 *                       example: true
 *                     isUk:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Invalid or missing coordinates.
 */
router.get('/detect', location_controller_1.default.detectLocation);
/**
 * @openapi
 * /api/v1/location/detect-ip-country:
 *   get:
 *     tags:
 *       - Location
 *     summary: Detect Client Country from IP Address
 *     description: Inspects client IP address (x-forwarded-for / req.ip) and resolves country and target route (ng, it, or uk).
 *     responses:
 *       200:
 *         description: Country and target routing path returned successfully.
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
 *                     ip:
 *                       type: string
 *                       example: "102.89.23.12"
 *                     country:
 *                       type: string
 *                       example: "Nigeria"
 *                     countryCode:
 *                       type: string
 *                       example: "NG"
 *                     targetRoute:
 *                       type: string
 *                       example: "ng"
 *                     isNigeria:
 *                       type: boolean
 *                       example: true
 *                     isItaly:
 *                       type: boolean
 *                       example: false
 *                     isUk:
 *                       type: boolean
 *                       example: false
 */
router.get('/detect-ip-country', location_controller_1.default.detectIpCountry);
/**
 * @openapi
 * /api/v1/location/update-location:
 *   post:
 *     tags:
 *       - Location
 *     summary: Update Authenticated User GPS Location
 *     description: Updates the live geographic coordinates and online status of the authenticated rider, driver, or customer.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - coordinates
 *             properties:
 *               coordinates:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: Coordinates in GeoJSON format [longitude, latitude]
 *                 example: [3.3792, 6.5244]
 *               heading:
 *                 type: number
 *                 description: Compass heading in degrees
 *                 example: 90
 *               speed:
 *                 type: number
 *                 description: Movement speed in meters per second
 *                 example: 4.5
 *     responses:
 *       200:
 *         description: Location updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Location updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     coordinates:
 *                       type: array
 *                       items:
 *                         type: number
 *                     heading:
 *                       type: number
 *                     speed:
 *                       type: number
 *       400:
 *         description: Missing or invalid coordinates format.
 *       401:
 *         description: Unauthorized. Missing or invalid Bearer token.
 */
router.post('/update-location', auth_middleware_1.protect, location_controller_1.default.updateLocation);
/**
 * @openapi
 * /api/v1/location/distance:
 *   post:
 *     tags:
 *       - Location
 *     summary: Calculate Route Distance and Duration
 *     description: Calculates driving distance and estimated time between origin and destination coordinates using Google Maps Distance Matrix.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - origin
 *               - destination
 *             properties:
 *               origin:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: Origin coordinates [longitude, latitude]
 *                 example: [3.3792, 6.5244]
 *               destination:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: Destination coordinates [longitude, latitude]
 *                 example: [3.3850, 6.5300]
 *     responses:
 *       200:
 *         description: Route distance and duration calculated successfully.
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
 *                     distanceText:
 *                       type: string
 *                       example: "2.5 km"
 *                     durationText:
 *                       type: string
 *                       example: "8 mins"
 *                     distanceValue:
 *                       type: number
 *                       example: 2500
 *                     durationValue:
 *                       type: number
 *                       example: 480
 *       400:
 *         description: Missing or invalid origin/destination coordinates.
 */
router.post('/distance', location_controller_1.default.getDistance);
exports.default = router;
