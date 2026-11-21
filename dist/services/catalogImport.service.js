"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogImportService = void 0;
const foodItem_model_1 = __importDefault(require("../models/foodItem.model"));
const category_model_1 = __importDefault(require("../models/category.model"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
class CatalogImportService {
    /**
     * Parses raw CSV string according to the GoEatOne Universal Upload standard
     */
    static parseCsvString(csvContent) {
        const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2)
            return [];
        const rows = [];
        const headerLine = lines[0];
        const headers = this.parseCsvLine(headerLine).map((h) => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            // Skip empty or instruction note rows
            if (!line ||
                line.startsWith('GOEATONE') ||
                line.startsWith('Purpose,') ||
                line.startsWith('Minimum required,') ||
                line.startsWith('Currencies,') ||
                line.startsWith('Outlet Type,') ||
                line.startsWith('Optional fields,') ||
                line.startsWith('Inventory,') ||
                line.startsWith('Photos,') ||
                line.startsWith('Options / Extras,') ||
                line.startsWith('Data safety,') ||
                line.startsWith('Location,') ||
                line.startsWith('How to submit,')) {
                continue;
            }
            // Check if row is a duplicate header
            if (line.toLowerCase().startsWith('product id,')) {
                continue;
            }
            const cols = this.parseCsvLine(line);
            if (cols.length < 4)
                continue;
            const getCol = (name) => {
                const cleanName = name.toLowerCase().replace(/[\s_-]+/g, '');
                const idx = headers.findIndex((h) => {
                    const cleanH = h.toLowerCase().replace(/[\s_-]+/g, '');
                    return cleanH.includes(cleanName);
                });
                return idx >= 0 && cols[idx] !== undefined ? cols[idx].trim() : '';
            };
            const productId = getCol('product id') || getCol('id') || getCol('sku');
            const productName = getCol('product name') || getCol('name') || getCol('title');
            const categoryName = getCol('category');
            const priceStr = getCol('price').replace(/[^0-9.]/g, '');
            const price = parseFloat(priceStr) || 0;
            if (!productId || !productName)
                continue;
            const rawAllergens = getCol('allergens');
            const allergens = rawAllergens
                ? rawAllergens
                    .split(/[,;/]/)
                    .map((a) => a.trim())
                    .filter(Boolean)
                : [];
            const rawAvailable = getCol('available').toLowerCase();
            const isAvailable = rawAvailable === 'yes' || rawAvailable === 'true' || rawAvailable === '1' || rawAvailable === '';
            const prepTimeMin = parseInt(getCol('prep time'), 10) || undefined;
            const stockQtyStr = getCol('stock qty') || getCol('inventory') || getCol('qty');
            const stockQty = stockQtyStr ? parseInt(stockQtyStr, 10) : undefined;
            const imageUrl = getCol('image') || getCol('photo') || getCol('picture') || undefined;
            rows.push({
                productId,
                outletType: getCol('outlet type') || undefined,
                categoryName: categoryName || 'General',
                productName,
                description: getCol('description') || productName,
                price,
                currency: getCol('currency') || 'NGN',
                unitSize: getCol('unit') || undefined,
                stockQty,
                prepTimeMin,
                imageUrl,
                optionsExtras: getCol('options') || undefined,
                allergens,
                isAvailable,
            });
        }
        return rows;
    }
    /**
     * Helper to parse CSV lines with commas inside quotes
     */
    static parseCsvLine(text) {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c === '"') {
                if (inQuotes && text[i + 1] === '"') {
                    cur += '"';
                    i++;
                }
                else {
                    inQuotes = !inQuotes;
                }
            }
            else if (c === ',' && !inQuotes) {
                result.push(cur);
                cur = '';
            }
            else {
                cur += c;
            }
        }
        result.push(cur);
        return result;
    }
    /**
     * Imports or idempotently updates catalog items for a restaurant
     */
    static async importCatalog(restaurantId, csvContent) {
        const restaurant = await restaurant_model_1.default.findById(restaurantId);
        if (!restaurant) {
            throw new Error('Restaurant not found');
        }
        const rows = this.parseCsvString(csvContent);
        const result = {
            totalRows: rows.length,
            createdCount: 0,
            updatedCount: 0,
            failedCount: 0,
            errors: [],
        };
        // Category cache for fast resolution
        const categoryCache = new Map();
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                // 1. Resolve or create category
                let categoryId = categoryCache.get(row.categoryName.toLowerCase());
                if (!categoryId) {
                    let cat = await category_model_1.default.findOne({
                        name: { $regex: new RegExp(`^${row.categoryName.trim()}$`, 'i') },
                        restaurant: restaurantId,
                    });
                    if (!cat) {
                        cat = await category_model_1.default.create({
                            name: row.categoryName.trim(),
                            restaurant: restaurantId,
                            description: `${row.categoryName} items`,
                            isActive: true,
                        });
                    }
                    categoryId = cat._id;
                    categoryCache.set(row.categoryName.toLowerCase(), categoryId);
                }
                // 2. Upsert FoodItem by sku (Product ID) within this restaurant
                const existingItem = await foodItem_model_1.default.findOne({
                    sku: row.productId,
                    restaurant: restaurantId,
                });
                if (existingItem) {
                    existingItem.name = row.productName;
                    existingItem.description = row.description;
                    existingItem.price = row.price;
                    existingItem.category = categoryId;
                    existingItem.isAvailable = row.isAvailable;
                    if (row.imageUrl)
                        existingItem.image = row.imageUrl;
                    if (row.prepTimeMin)
                        existingItem.preparationTime = row.prepTimeMin;
                    if (row.allergens && row.allergens.length > 0)
                        existingItem.allergens = row.allergens;
                    if (row.stockQty !== undefined) {
                        existingItem.stockQuantity = row.stockQty;
                        existingItem.inStock = row.stockQty > 0;
                    }
                    await existingItem.save();
                    result.updatedCount++;
                }
                else {
                    await foodItem_model_1.default.create({
                        sku: row.productId,
                        name: row.productName,
                        description: row.description,
                        price: row.price,
                        image: row.imageUrl || 'default-food.png',
                        category: categoryId,
                        restaurant: restaurantId,
                        isAvailable: row.isAvailable,
                        preparationTime: row.prepTimeMin || 20,
                        allergens: row.allergens || [],
                        stockQuantity: row.stockQty,
                        inStock: row.stockQty !== undefined ? row.stockQty > 0 : true,
                    });
                    result.createdCount++;
                }
            }
            catch (err) {
                result.failedCount++;
                result.errors.push({
                    rowNumber: i + 2,
                    productId: row.productId,
                    message: err.message || 'Failed to save item',
                });
            }
        }
        return result;
    }
}
exports.CatalogImportService = CatalogImportService;
