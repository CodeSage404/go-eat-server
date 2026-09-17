import PromoBanner, { IPromoBanner } from '../models/promoBanner.model';

class PromoBannerService {
  /**
   * Retrieves the promo banner config. Ensures at least one singleton record exists.
   */
  async getOrCreateBanner(): Promise<IPromoBanner> {
    let banner = await PromoBanner.findOne();
    if (!banner) {
      banner = await PromoBanner.create({
        isActive: true,
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
  async getActiveBanner(): Promise<IPromoBanner | null> {
    return await this.getOrCreateBanner();
  }

  /**
   * Returns banner configuration for Admin dashboard.
   */
  async getAdminBanner(): Promise<IPromoBanner> {
    return this.getOrCreateBanner();
  }

  /**
   * Updates banner settings (toggle active, update copy, image, etc.)
   */
  async updateBanner(payload: Partial<IPromoBanner>): Promise<IPromoBanner> {
    const banner = await this.getOrCreateBanner();

    if (payload.isActive !== undefined) banner.isActive = payload.isActive;
    if (payload.topSpotsTitle !== undefined) banner.topSpotsTitle = payload.topSpotsTitle;
    if (payload.offersTitle !== undefined) banner.offersTitle = payload.offersTitle;
    if (payload.offersSubtitle !== undefined) banner.offersSubtitle = payload.offersSubtitle;
    if (payload.headline !== undefined) banner.headline = payload.headline;
    if (payload.subtitle !== undefined) banner.subtitle = payload.subtitle;
    if (payload.ctaText !== undefined) banner.ctaText = payload.ctaText;
    if (payload.ctaLink !== undefined) banner.ctaLink = payload.ctaLink;
    if (payload.voucherText !== undefined) banner.voucherText = payload.voucherText;
    if (payload.imageUrl !== undefined) banner.imageUrl = payload.imageUrl;
    if (payload.backgroundColor !== undefined) banner.backgroundColor = payload.backgroundColor;
    if (payload.backgroundColorDark !== undefined) banner.backgroundColorDark = payload.backgroundColorDark;

    await banner.save();
    return banner;
  }
}

export default new PromoBannerService();
