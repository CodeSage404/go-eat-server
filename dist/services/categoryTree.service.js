"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPECIALTY_SUBCATEGORIES = exports.PERMANENT_CATEGORIES = void 0;
exports.syncPermanentCategoryTree = syncPermanentCategoryTree;
const category_model_1 = __importDefault(require("../models/category.model"));
const logger_1 = __importDefault(require("../utils/logger"));
exports.PERMANENT_CATEGORIES = [
    {
        name: 'Restaurant',
        systemCode: 'RESTAURANT',
        sellingModel: 'FOOD_MENU',
        order: 1,
        sortOrder: 1,
        isSystemPermanent: true,
        isGlobal: true,
        description: 'Freshly prepared meals, dine-in and takeaway delicacies',
        icon: 'restaurant-category',
        image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
    },
    {
        name: 'Grocery',
        systemCode: 'GROCERY',
        sellingModel: 'RETAIL_PRODUCT',
        order: 2,
        sortOrder: 2,
        isSystemPermanent: true,
        isGlobal: true,
        description: 'Everyday fresh groceries, pantry staples and household essentials',
        icon: 'groceries-category',
        image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
    },
    {
        name: 'Convenience',
        systemCode: 'CONVENIENCE',
        sellingModel: 'RETAIL_PRODUCT',
        order: 3,
        sortOrder: 3,
        isSystemPermanent: true,
        isGlobal: true,
        description: 'Quick snacks, drinks, emergency supplies and everyday essentials',
        icon: 'convenience-category',
        image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80',
    },
    {
        name: 'Specialty Store',
        systemCode: 'SPECIALTY_STORE',
        sellingModel: 'RETAIL_PRODUCT',
        order: 4,
        sortOrder: 4,
        isSystemPermanent: true,
        isGlobal: true,
        description: 'Curated wellness, pet and floral boutiques',
        icon: 'specialty-category',
        image: 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=600&q=80',
    },
    {
        name: 'Smokey-Wheels',
        systemCode: 'SMOKEY_WHEELS',
        sellingModel: 'FOOD_MENU',
        order: 5,
        sortOrder: 5,
        isSystemPermanent: true,
        isGlobal: true,
        description: 'Street-side grills, gourmet food trucks and mobile barbecue pits',
        icon: 'smokey-category',
        image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
    },
    {
        name: 'Signature Chef',
        systemCode: 'SIGNATURE_CHEF',
        sellingModel: 'FOOD_MENU',
        order: 6,
        sortOrder: 6,
        isSystemPermanent: true,
        isGlobal: true,
        description: 'Artisanal private chefs, bespoke meal creations and culinary masters',
        icon: 'chef-category',
        image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=600&q=80',
    },
];
exports.SPECIALTY_SUBCATEGORIES = [
    {
        name: 'Health & Wellness',
        systemCode: 'SPECIALTY_HEALTH',
        sellingModel: 'RETAIL_PRODUCT',
        parentCode: 'SPECIALTY_STORE',
        order: 1,
        sortOrder: 1,
        isSystemPermanent: true,
        isGlobal: true,
        description: 'Supplements, organic remedies, wellness products and health items',
        icon: 'health-category',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    },
    {
        name: 'Pet Shop',
        systemCode: 'SPECIALTY_PET',
        sellingModel: 'RETAIL_PRODUCT',
        parentCode: 'SPECIALTY_STORE',
        order: 2,
        sortOrder: 2,
        isSystemPermanent: true,
        isGlobal: true,
        description: 'Nutritious pet food, pet treats, grooming accessories and toys',
        icon: 'pet-category',
        image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=600&q=80',
    },
    {
        name: 'Flower Shop',
        systemCode: 'SPECIALTY_FLOWER',
        sellingModel: 'RETAIL_PRODUCT',
        parentCode: 'SPECIALTY_STORE',
        order: 3,
        sortOrder: 3,
        isSystemPermanent: true,
        isGlobal: true,
        description: 'Hand-tied fresh flower bouquets, floral arrangements, cards and vases',
        icon: 'flower-category',
        image: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=600&q=80',
    },
];
/**
 * Ensures all permanent categories and subcategories exist and are locked in MongoDB.
 */
async function syncPermanentCategoryTree() {
    try {
        const parentMap = new Map();
        // 1. Seed or update top-level permanent categories
        for (const catDef of exports.PERMANENT_CATEGORIES) {
            let existing = await category_model_1.default.findOne({
                $or: [
                    { systemCode: catDef.systemCode },
                    { name: { $regex: new RegExp(`^${catDef.name}$`, 'i') }, isGlobal: true },
                ],
            });
            if (existing) {
                existing.systemCode = catDef.systemCode;
                existing.sellingModel = catDef.sellingModel;
                existing.isSystemPermanent = true;
                existing.order = catDef.order;
                existing.sortOrder = catDef.sortOrder;
                if (!existing.description)
                    existing.description = catDef.description;
                if (!existing.image)
                    existing.image = catDef.image;
                if (!existing.icon)
                    existing.icon = catDef.icon;
                await existing.save();
                parentMap.set(catDef.systemCode, existing);
            }
            else {
                const created = await category_model_1.default.create({
                    name: catDef.name,
                    systemCode: catDef.systemCode,
                    sellingModel: catDef.sellingModel,
                    order: catDef.order,
                    sortOrder: catDef.sortOrder,
                    isSystemPermanent: true,
                    isGlobal: true,
                    isActive: true,
                    description: catDef.description,
                    icon: catDef.icon,
                    image: catDef.image,
                });
                parentMap.set(catDef.systemCode, created);
            }
        }
        // 2. Seed or update child subcategories (Specialty Store children)
        const specialtyStoreParent = parentMap.get('SPECIALTY_STORE') || await category_model_1.default.findOne({ systemCode: 'SPECIALTY_STORE' });
        const parentId = specialtyStoreParent?._id;
        for (const subDef of exports.SPECIALTY_SUBCATEGORIES) {
            let existingSub = await category_model_1.default.findOne({
                $or: [
                    { systemCode: subDef.systemCode },
                    { name: { $regex: new RegExp(`^${subDef.name}$`, 'i') }, isGlobal: true },
                ],
            });
            if (existingSub) {
                existingSub.systemCode = subDef.systemCode;
                existingSub.sellingModel = subDef.sellingModel;
                existingSub.isSystemPermanent = true;
                existingSub.parentId = parentId || existingSub.parentId;
                existingSub.order = subDef.order;
                existingSub.sortOrder = subDef.sortOrder;
                if (!existingSub.description)
                    existingSub.description = subDef.description;
                if (!existingSub.image)
                    existingSub.image = subDef.image;
                if (!existingSub.icon)
                    existingSub.icon = subDef.icon;
                await existingSub.save();
            }
            else {
                await category_model_1.default.create({
                    name: subDef.name,
                    systemCode: subDef.systemCode,
                    sellingModel: subDef.sellingModel,
                    parentId,
                    order: subDef.order,
                    sortOrder: subDef.sortOrder,
                    isSystemPermanent: true,
                    isGlobal: true,
                    isActive: true,
                    description: subDef.description,
                    icon: subDef.icon,
                    image: subDef.image,
                });
            }
        }
        logger_1.default.info('✅ Successfully verified & synced permanent GoEatOne category tree.');
    }
    catch (err) {
        logger_1.default.warn('Failed to sync permanent category tree:', err.message);
    }
}
