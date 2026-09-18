import PromoBanner, { IPromoBanner } from '../models/promoBanner.model';
import Promo from '../models/promo.model';

class PromoBannerService {
  /**
   * Retrieves the promo banner config. Ensures at least one singleton record exists.
   */
  async getOrCreateBanner(): Promise<IPromoBanner> {
    let banner = await PromoBanner.findOne();
    if (!banner) {
      banner = await PromoBanner.create({
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
  async getActiveBanner(): Promise<IPromoBanner | null> {
    return await this.getOrCreateBanner();
  }

  /**
   * Returns active banners for carousel display including live promo codes
   */
  async getActiveBanners(): Promise<{ banner: IPromoBanner | null; banners: any[] }> {
    const primaryBanner = await this.getOrCreateBanner();

    // If admin has disabled carousel, only return the primary banner
    if (primaryBanner && primaryBanner.isCarouselEnabled === false) {
      return {
        banner: primaryBanner,
        banners: primaryBanner.isActive ? [primaryBanner] : [],
      };
    }

    const banners: any[] = [];

    if (primaryBanner && primaryBanner.isActive) {
      banners.push(primaryBanner);
    }

    // If admin has uploaded custom carousel slides, include them
    if (primaryBanner && primaryBanner.slides && primaryBanner.slides.length > 0) {
      for (const slide of primaryBanner.slides) {
        if (slide.isActive !== false) {
          banners.push(slide);
        }
      }
    }

    try {
      // Find active public promos
      const activePromos = await Promo.find({
        isActive: true,
        expiryDate: { $gt: new Date() },
      })
        .populate('restaurant', 'name images')
        .limit(5);

      const colorPalette = [
        { light: '#0F3D26', dark: '#082819' }, // Brand green
        { light: '#1E3A8A', dark: '#172554' }, // Royal navy
        { light: '#9A3412', dark: '#7C2D12' }, // Warm spice
      ];

      activePromos.forEach((p, idx) => {
        const restName = (p.restaurant as any)?.name;
        const palette = colorPalette[idx % colorPalette.length];
        banners.push({
          _id: p._id.toString(),
          isActive: true,
          headline: restName ? `${p.discountPercentage}% OFF at ${restName}` : `${p.discountPercentage}% OFF Orders`,
          subtitle: `Use code ${p.code} at checkout. ${p.minOrderAmount ? `Min. spend ₦${p.minOrderAmount.toLocaleString()}.` : 'No minimum spend.'}`,
          ctaText: `Use ${p.code}`,
          ctaLink: '/voucher',
          voucherText: `${p.discountPercentage}% off`,
          code: p.code,
          imageUrl: (p.restaurant as any)?.images?.cover || '',
          backgroundColor: palette.light,
          backgroundColorDark: palette.dark,
        });
      });
    } catch (err) {
      // If promo query fails, keep fallback banner
    }

    // If only 1 banner exists, add complementary curated active promotions to make the carousel vibrant
    if (banners.length === 1) {
      banners.push({
        _id: 'promo-card-free-delivery',
        isActive: true,
        headline: 'Free Delivery Feast',
        subtitle: 'Enjoy ₦0 delivery fee on selected top spots near you today!',
        ctaText: 'Explore spots',
        ctaLink: '/(home)/map-view',
        voucherText: 'Free Delivery',
        backgroundColor: '#0F3D26',
        backgroundColorDark: '#082819',
      });
      banners.push({
        _id: 'promo-card-flash-discount',
        isActive: true,
        headline: 'Weekend Flash 15%',
        subtitle: 'Get 15% off delicious local meals using code GOEAT15 at checkout.',
        ctaText: 'Claim 15% off',
        ctaLink: '/voucher',
        voucherText: '15% off',
        code: 'GOEAT15',
        backgroundColor: '#1E3A8A',
        backgroundColorDark: '#172554',
      });
    }

    return {
      banner: primaryBanner,
      banners,
    };
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
    if (payload.isCarouselEnabled !== undefined) banner.isCarouselEnabled = payload.isCarouselEnabled;
    if (payload.slides !== undefined) banner.slides = payload.slides;
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
