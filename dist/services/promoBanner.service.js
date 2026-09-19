"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promoBanner_model_1 = __importDefault(require("../models/promoBanner.model"));
class PromoBannerService {
    /**
     * Retrieves the promo banner config. Ensures at least one singleton record exists.
     */
    async getOrCreateBanner() {
        let banner = await promoBanner_model_1.default.findOne();
        if (!banner) {
            banner = await promoBanner_model_1.default.create({
                isCarouselEnabled: true,
                slides: [],
                topSpotsTitle: 'Neighborhood Favorites',
                offersTitle: 'Tasty Offers',
                offersSubtitle: 'Tailored to your taste buds',
                headline: 'Save ₦3,000',
                subtitle: 'Enjoy ₦1,000 off your first three orders. Min. spend applies. T&Cs apply.',
                ctaText: 'Order now',
                ctaLink: '/voucher',
                voucherText: '₦1,000 off',
                imageUrl: '',
                backgroundColor: '#F5B743',
                backgroundColorDark: '#D99B26',
            });
        }
        return banner;
    }
    /**
     * Returns promo banner configuration for mobile apps / customer clients.
     */
    async getActiveBanner() {
        const banner = await this.getOrCreateBanner();
        if (!banner || banner.isActive === false) {
            return null;
        }
        return banner;
    }
    /**
     * Returns active banners. If admin has disabled promo banner, returns empty list.
     */
    async getActiveBanners() {
        const primaryBanner = await this.getOrCreateBanner();
        if (!primaryBanner || primaryBanner.isActive === false) {
            return {
                banner: null,
                banners: [],
            };
        }
        return {
            banner: primaryBanner,
            banners: [primaryBanner],
        };
    }
    /**
     * Returns banner configuration for Admin dashboard.
     */
    async getAdminBanner() {
        return this.getOrCreateBanner();
    }
    /**
     * Updates banner settings (toggle active, update copy, image, etc.)
     */
    async updateBanner(payload) {
        const banner = await this.getOrCreateBanner();
        if (payload.isActive !== undefined)
            banner.isActive = payload.isActive;
        if (payload.isCarouselEnabled !== undefined)
            banner.isCarouselEnabled = payload.isCarouselEnabled;
        if (payload.slides !== undefined)
            banner.slides = payload.slides;
        if (payload.topSpotsTitle !== undefined)
            banner.topSpotsTitle = payload.topSpotsTitle;
        if (payload.offersTitle !== undefined)
            banner.offersTitle = payload.offersTitle;
        if (payload.offersSubtitle !== undefined)
            banner.offersSubtitle = payload.offersSubtitle;
        if (payload.headline !== undefined)
            banner.headline = payload.headline;
        if (payload.subtitle !== undefined)
            banner.subtitle = payload.subtitle;
        if (payload.ctaText !== undefined)
            banner.ctaText = payload.ctaText;
        if (payload.ctaLink !== undefined)
            banner.ctaLink = payload.ctaLink;
        if (payload.voucherText !== undefined)
            banner.voucherText = payload.voucherText;
        if (payload.imageUrl !== undefined)
            banner.imageUrl = payload.imageUrl;
        if (payload.backgroundColor !== undefined)
            banner.backgroundColor = payload.backgroundColor;
        if (payload.backgroundColorDark !== undefined)
            banner.backgroundColorDark = payload.backgroundColorDark;
        await banner.save();
        return banner;
    }
}
exports.default = new PromoBannerService();
