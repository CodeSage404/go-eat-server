"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promoBanner_service_1 = __importDefault(require("../services/promoBanner.service"));
const catchAsync_1 = require("../utils/catchAsync");
class PromoBannerController {
    constructor() {
        /**
         * Client/User App: Get active promo banner and banners carousel
         */
        this.getActiveBanner = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const result = await promoBanner_service_1.default.getActiveBanners();
            res.status(200).json({
                status: 'success',
                data: {
                    banner: result.banner,
                    banners: result.banners,
                },
            });
        });
        /**
         * Admin: Get promo banner configuration
         */
        this.getAdminBanner = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const banner = await promoBanner_service_1.default.getAdminBanner();
            res.status(200).json({
                status: 'success',
                data: { banner },
            });
        });
        /**
         * Admin: Update promo banner configuration & toggle state
         */
        this.updateBanner = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const banner = await promoBanner_service_1.default.updateBanner(req.body);
            res.status(200).json({
                status: 'success',
                data: { banner },
            });
        });
    }
}
exports.default = new PromoBannerController();
