"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const promo_controller_1 = __importDefault(require("../controllers/promo.controller"));
const promoBanner_controller_1 = __importDefault(require("../controllers/promoBanner.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /api/v1/promos/banner:
 *   get:
 *     tags:
 *       - Promotions
 *     summary: Get the active home screen promotional banner
 *     description: Returns the active promotional banner configuration if enabled by the administrator.
 *     responses:
 *       200:
 *         description: Active promo banner returned successfully
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
 *                     banner:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         _id:
 *                           type: string
 *                         isActive:
 *                           type: boolean
 *                         isCarouselEnabled:
 *                           type: boolean
 *                           description: Whether customer app renders promo banners in a cycling carousel
 *                         headline:
 *                           type: string
 *                         subtitle:
 *                           type: string
 *                         ctaText:
 *                           type: string
 *                         ctaLink:
 *                           type: string
 *                         voucherText:
 *                           type: string
 *                         imageUrl:
 *                           type: string
 *                         backgroundColor:
 *                           type: string
 *                         backgroundColorDark:
 *                           type: string
 *                         topSpotsTitle:
 *                           type: string
 *                           example: Neighborhood Favorites
 *                         offersTitle:
 *                           type: string
 *                           example: Tasty Offers
 *                         offersSubtitle:
 *                           type: string
 *                           example: Tailored to your taste buds
 *                     banners:
 *                       type: array
 *                       description: List of active promotional banners for carousel display
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           headline:
 *                             type: string
 *                           subtitle:
 *                             type: string
 *                           ctaText:
 *                             type: string
 *                           ctaLink:
 *                             type: string
 *                           voucherText:
 *                             type: string
 *                           code:
 *                             type: string
 *                           imageUrl:
 *                             type: string
 *                           backgroundColor:
 *                             type: string
 *                           backgroundColorDark:
 *                             type: string
 */
router.get('/banner', promoBanner_controller_1.default.getActiveBanner);
router.use(auth_middleware_1.protect);
/**
 * @openapi
 * /api/v1/promos/banner/config:
 *   get:
 *     tags:
 *       - Promotions
 *     summary: Get promotional banner settings
 *     description: Retrieve the promotional banner configuration for administrators and vendors.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Promo banner configuration returned successfully
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
 *                     banner:
 *                       type: object
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - only admins and vendors can access
 */
router.get('/banner/config', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.VENDOR), promoBanner_controller_1.default.getAdminBanner);
/**
 * @openapi
 * /api/v1/promos/banner:
 *   put:
 *     tags:
 *       - Promotions
 *     summary: Update promotional banner settings
 *     description: Update copy, graphics, and toggle active state of promotional banner by administrators or vendors.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 description: Whether the promo banner is visible on the customer app
 *               isCarouselEnabled:
 *                 type: boolean
 *                 description: Whether banners run in carousel mode or static display
 *               slides:
 *                 type: array
 *                 description: Custom promotional slides configured by administrator
 *                 items:
 *                   type: object
 *               headline:
 *                 type: string
 *                 description: Main bold headline text
 *               subtitle:
 *                 type: string
 *                 description: Subtitle explanation text
 *               ctaText:
 *                 type: string
 *                 description: Call to action button text
 *               ctaLink:
 *                 type: string
 *                 description: In-app target link
 *               voucherText:
 *                 type: string
 *                 description: Promo tag badge text
 *               imageUrl:
 *                 type: string
 *                 description: Optional uploaded graphic URL
 *               backgroundColor:
 *                 type: string
 *                 description: Light theme background hex color
 *               backgroundColorDark:
 *                 type: string
 *                 description: Dark theme background hex color
 *               topSpotsTitle:
 *                 type: string
 *                 description: Header text for top food spots section (e.g. Neighborhood Favorites)
 *               offersTitle:
 *                 type: string
 *                 description: Header text for special offers section (e.g. Tasty Offers)
 *               offersSubtitle:
 *                 type: string
 *                 description: Subtitle text for special offers section (e.g. Tailored to your taste buds)
 *     responses:
 *       200:
 *         description: Promo banner updated successfully
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
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - only admins and vendors can access
 */
router.put('/banner', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.VENDOR), promoBanner_controller_1.default.updateBanner);
/**
 * @openapi
 * /api/v1/promos/apply:
 *   post:
 *     tags:
 *       - Promotions
 *     summary: Apply a promo code to an order
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, orderAmount]
 *             properties:
 *               code:
 *                 type: string
 *               orderAmount:
 *                 type: number
 *               restaurantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Promo applied, returns discount amount
 */
router.post('/apply', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.CUSTOMER), promo_controller_1.default.applyPromo);
/**
 * @openapi
 * /api/v1/promos:
 *   post:
 *     tags:
 *       - Promotions
 *     summary: Create a new promotion
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, discountPercentage, expiryDate]
 *             properties:
 *               code:
 *                 type: string
 *               discountPercentage:
 *                 type: number
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *               foodItemId:
 *                 type: string
 *                 description: Optional ID of a specific food item to apply the discount to
 *     responses:
 *       201:
 *         description: Promo created
 */
router.post('/', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.VENDOR), promo_controller_1.default.createPromo);
/**
 * @openapi
 * /api/v1/promos/my-promos:
 *   get:
 *     tags:
 *       - Promotions
 *     summary: Get all promotions created by the vendor
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of vendor's promos
 */
router.get('/my-promos', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), promo_controller_1.default.getVendorPromos);
/**
 * @openapi
 * /api/v1/promos/{id}:
 *   patch:
 *     tags:
 *       - Promotions
 *     summary: Update a vendor's promotion
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *               discountPercentage:
 *                 type: number
 *               expiryDate:
 *                 type: string
 *     responses:
 *       200:
 *         description: Promo updated
 */
router.patch('/:id', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), promo_controller_1.default.updateVendorPromo);
/**
 * @openapi
 * /api/v1/promos/{id}:
 *   delete:
 *     tags:
 *       - Promotions
 *     summary: Delete a vendor's promotion
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Promo deleted
 */
router.delete('/:id', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), promo_controller_1.default.deleteVendorPromo);
exports.default = router;
