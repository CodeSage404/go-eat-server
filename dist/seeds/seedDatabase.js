"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const envPath = path_1.default.join(__dirname, '../../.env');
dotenv_1.default.config({ path: envPath });
const category_model_1 = __importDefault(require("../models/category.model"));
const restaurant_model_1 = __importStar(require("../models/restaurant.model"));
const foodItem_model_1 = __importDefault(require("../models/foodItem.model"));
const user_model_1 = __importStar(require("../models/user.model"));
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/go-eat';
const seedCategories = [
    {
        name: 'Rice & Grains',
        slug: 'rice-grains',
        image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80',
        icon: 'rice-craving',
        description: 'Smoky Jollof Rice, Fried Rice, Ofada, and Basmati Delights',
        order: 1,
        isGlobal: true,
    },
    {
        name: 'Swallow & Soups',
        slug: 'swallow-soups',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        icon: 'eba-craving',
        description: 'Pounded Yam, Eba, Amala with Egusi, Ogbono, and Oha soup',
        order: 2,
        isGlobal: true,
        country: 'Nigeria',
        countryCode: 'NG',
    },
    {
        name: 'Fast Food & Chicken',
        slug: 'fast-food',
        image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80',
        icon: 'chicken-craving',
        description: 'Crispy Fried Chicken, Burgers, Chips, and Wraps',
        order: 3,
        isGlobal: true,
    },
    {
        name: 'Pizza & Bakery',
        slug: 'pizza-bakery',
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
        icon: 'pizza-craving',
        description: 'Freshly Baked Pizzas, Cakes, Pastries & Meatpies',
        order: 4,
        isGlobal: true,
    },
    {
        name: 'Drinks & Smoothies',
        slug: 'drinks-smoothies',
        image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
        icon: 'drink-category',
        description: 'Refreshing Juices, Soft Drinks, Boba & Smoothies',
        order: 5,
        isGlobal: true,
    },
    {
        name: 'Groceries & Snacks',
        slug: 'groceries-snacks',
        image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
        icon: 'groceries-category',
        description: 'Everyday Groceries, Suya, Chips, & Household Essentials',
        order: 6,
        isGlobal: true,
    },
    {
        name: 'British Classics',
        slug: 'british-classics',
        image: 'https://images.unsplash.com/photo-1579208575657-c595a05383b7?auto=format&fit=crop&w=600&q=80',
        icon: 'fish-chips-craving',
        description: 'Traditional Fish & Chips, Sunday Roasts, Pies & Mash',
        order: 7,
        isGlobal: true,
        country: 'United Kingdom',
        countryCode: 'GB',
    },
    {
        name: 'Pasta & Trattoria',
        slug: 'pasta-trattoria',
        image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80',
        icon: 'pasta-craving',
        description: 'Artisanal Fresh Pasta, Carbonara, Cacio e Pepe & Antipasti',
        order: 8,
        isGlobal: true,
        country: 'Italy',
        countryCode: 'IT',
    },
];
const seedRestaurants = [
    // ===================== NIGERIAN OUTLETS =====================
    {
        data: {
            name: 'Kilimanjaro Restaurant',
            description: 'Premium Nigerian & Continental dishes made fresh daily.',
            images: {
                logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
                cover: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
            },
            address: {
                street: 'Chime Avenue, New Haven',
                city: 'Enugu',
                state: 'Enugu State',
                zipCode: '400211',
                country: 'Nigeria',
                countryCode: 'NG',
            },
            location: {
                type: 'Point',
                coordinates: [7.5191, 6.3084],
            },
            country: 'Nigeria',
            countryCode: 'NG',
            isNigeria: true,
            isUk: false,
            isItaly: false,
            cuisine: ['Nigerian', 'Rice', 'Fast Food'],
            rating: 4.8,
            numReviews: 342,
            estimatedDeliveryTime: 25,
            deliveryFee: 500,
            minOrderAmount: 1000,
            status: restaurant_model_1.RestaurantStatus.ACTIVE,
            openingHours: { open: '08:00', close: '22:00' },
        },
        items: [
            {
                name: 'Special Smoky Jollof Bowl - Kilimanjaro',
                description: 'Authentic Nigerian Smoky Party Jollof Rice served with Fried Plantain, Coleslaw, and Grilled Chicken.',
                price: 3500,
                image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'rice-grains',
                prepTime: '20 mins',
            },
            {
                name: 'Pounded Yam & Assorted Egusi Soup - Kilimanjaro',
                description: 'Fluffy Pounded Yam with rich Egusi soup loaded with Goat meat, Kanda, and Stockfish.',
                price: 4500,
                image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'swallow-soups',
                prepTime: '25 mins',
            },
            {
                name: 'Refuel Crunchy Chicken & Chips - Kilimanjaro',
                description: '2 pieces of golden crispy fried chicken with seasoned french fries and ketchup dip.',
                price: 3800,
                image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'fast-food',
                prepTime: '15 mins',
            },
            {
                name: 'Loaded Beef Pepperoni Pizza - Kilimanjaro',
                description: 'Freshly baked thin-crust pizza loaded with Mozzarella, Beef Pepperoni, and Bell Peppers.',
                price: 6500,
                image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'pizza-bakery',
                prepTime: '25 mins',
            },
        ],
    },
    {
        data: {
            name: 'Chicken Republic',
            description: 'Home of the famous Refuel Combo, Crunchy Chicken, and Citizens meal.',
            images: {
                logo: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?auto=format&fit=crop&w=300&q=80',
                cover: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80',
            },
            address: {
                street: 'Ogui Road',
                city: 'Enugu',
                state: 'Enugu State',
                zipCode: '400221',
                country: 'Nigeria',
                countryCode: 'NG',
            },
            location: {
                type: 'Point',
                coordinates: [7.5021, 6.4412],
            },
            country: 'Nigeria',
            countryCode: 'NG',
            isNigeria: true,
            isUk: false,
            isItaly: false,
            cuisine: ['Fast Food', 'Chicken', 'Rice'],
            rating: 4.7,
            numReviews: 512,
            estimatedDeliveryTime: 20,
            deliveryFee: 400,
            minOrderAmount: 800,
            status: restaurant_model_1.RestaurantStatus.ACTIVE,
            openingHours: { open: '07:30', close: '22:30' },
        },
        items: [
            {
                name: 'Citizens Meal with Fried Rice - Chicken Republic',
                description: 'Savory fried chicken thigh with seasoned fried rice and spicy pepper sauce.',
                price: 3200,
                image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'fast-food',
                prepTime: '15 mins',
            },
            {
                name: 'Refuel Max Combo with Jollof - Chicken Republic',
                description: '2 pcs crunchy chicken, double jollof rice scoop, and chilled beverage.',
                price: 4200,
                image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'rice-grains',
                prepTime: '15 mins',
            },
        ],
    },
    {
        data: {
            name: 'The Place Restaurant',
            description: 'Authentic Nigerian home-style cooking with grilled meats and special Parfait.',
            images: {
                logo: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=80',
                cover: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80',
            },
            address: {
                street: 'Victoria Island',
                city: 'Lagos',
                state: 'Lagos State',
                zipCode: '101241',
                country: 'Nigeria',
                countryCode: 'NG',
            },
            location: {
                type: 'Point',
                coordinates: [3.4219, 6.4281],
            },
            country: 'Nigeria',
            countryCode: 'NG',
            isNigeria: true,
            isUk: false,
            isItaly: false,
            cuisine: ['Nigerian', 'Grills', 'Soups'],
            rating: 4.9,
            numReviews: 890,
            estimatedDeliveryTime: 30,
            deliveryFee: 600,
            minOrderAmount: 1500,
            status: restaurant_model_1.RestaurantStatus.ACTIVE,
            openingHours: { open: '08:00', close: '23:00' },
        },
        items: [
            {
                name: 'Special Asun Rice Bowl - The Place',
                description: 'Spicy peppered goat meat chunks tossed with fragrant jollof rice.',
                price: 4800,
                image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'rice-grains',
                prepTime: '20 mins',
            },
        ],
    },
    // ===================== UK OUTLETS (LONDON) =====================
    {
        data: {
            name: 'The Crown & Lion Gastropub',
            description: 'Award-winning British pub serving golden Fish & Chips, Prime Sunday Roasts, and craft ales.',
            images: {
                logo: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=300&q=80',
                cover: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=800&q=80',
            },
            address: {
                street: '42 Baker Street, Marylebone',
                city: 'London',
                state: 'Greater London',
                zipCode: 'W1U 7DF',
                country: 'United Kingdom',
                countryCode: 'GB',
            },
            location: {
                type: 'Point',
                coordinates: [-0.1585, 51.5207],
            },
            country: 'United Kingdom',
            countryCode: 'GB',
            isUk: true,
            isNigeria: false,
            isItaly: false,
            cuisine: ['British Classics', 'Fish & Chips', 'Burgers & Fries', 'British Pub Fare'],
            rating: 4.9,
            numReviews: 620,
            estimatedDeliveryTime: 25,
            deliveryFee: 2.5,
            minOrderAmount: 10,
            status: restaurant_model_1.RestaurantStatus.ACTIVE,
            openingHours: { open: '11:00', close: '23:00' },
        },
        items: [
            {
                name: 'Traditional British Fish & Chips',
                description: 'Crispy beer-battered Atlantic cod fillet, triple-cooked chips, mushy peas, and homemade tartare sauce.',
                price: 13.5,
                image: 'https://images.unsplash.com/photo-1579208575657-c595a05383b7?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'british-classics',
                prepTime: '20 mins',
            },
            {
                name: 'Prime Sunday Roast Beef & Yorkshire Pudding',
                description: 'Aged roast beef striploin with giant fluffy Yorkshire pudding, roast potatoes, seasonal greens, and rich gravy.',
                price: 16.95,
                image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'british-classics',
                prepTime: '25 mins',
            },
            {
                name: 'Crown Gourmet Angus Burger',
                description: 'Dry-aged British beef patty, smoked cheddar, bacon jam, brioche bun, and skin-on skinny fries.',
                price: 12.0,
                image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'fast-food',
                prepTime: '15 mins',
            },
            {
                name: 'Sticky Toffee Pudding with Clotted Cream',
                description: 'Warm date sponge drenched in rich salted butterscotch sauce with Cornish clotted cream.',
                price: 6.5,
                image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'drinks-smoothies',
                prepTime: '10 mins',
            },
        ],
    },
    {
        data: {
            name: 'Dishoom Covent Garden',
            description: 'From Bombay with love. Legendary aromatic curries, freshly baked garlic naan, and house chai.',
            images: {
                logo: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=300&q=80',
                cover: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
            },
            address: {
                street: '12 Upper St. Martin’s Lane',
                city: 'London',
                state: 'Greater London',
                zipCode: 'WC2H 9FB',
                country: 'United Kingdom',
                countryCode: 'GB',
            },
            location: {
                type: 'Point',
                coordinates: [-0.1276, 51.5126],
            },
            country: 'United Kingdom',
            countryCode: 'GB',
            isUk: true,
            isNigeria: false,
            isItaly: false,
            cuisine: ['Indian & Curry', 'Asian & Katsu', 'Rice & Grains'],
            rating: 4.8,
            numReviews: 950,
            estimatedDeliveryTime: 30,
            deliveryFee: 3.0,
            minOrderAmount: 15,
            status: restaurant_model_1.RestaurantStatus.ACTIVE,
            openingHours: { open: '12:00', close: '23:00' },
        },
        items: [
            {
                name: 'Chicken Ruby Curry & Garlic Naan',
                description: 'Tender chicken steeped in a rich, silky makhani tomato cream curry with freshly baked garlic butter naan.',
                price: 14.5,
                image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'rice-grains',
                prepTime: '20 mins',
            },
            {
                name: 'House Black Daal & Basmati Rice',
                description: 'A Dishoom signature: dark, velvety lentils cooked patiently over 24 hours with fragrant steamed rice.',
                price: 10.5,
                image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'rice-grains',
                prepTime: '15 mins',
            },
        ],
    },
    {
        data: {
            name: 'Wagamama Soho',
            description: 'Fresh Asian soul food, piping hot chicken katsu curry bowls, and steaming ramen.',
            images: {
                logo: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=300&q=80',
                cover: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80',
            },
            address: {
                street: '10A Lexington Street, Soho',
                city: 'London',
                state: 'Greater London',
                zipCode: 'W1F 0LD',
                country: 'United Kingdom',
                countryCode: 'GB',
            },
            location: {
                type: 'Point',
                coordinates: [-0.1374, 51.5135],
            },
            country: 'United Kingdom',
            countryCode: 'GB',
            isUk: true,
            isNigeria: false,
            isItaly: false,
            cuisine: ['Asian & Katsu', 'Fast Food', 'Rice & Grains'],
            rating: 4.7,
            numReviews: 780,
            estimatedDeliveryTime: 20,
            deliveryFee: 2.0,
            minOrderAmount: 12,
            status: restaurant_model_1.RestaurantStatus.ACTIVE,
            openingHours: { open: '11:30', close: '22:30' },
        },
        items: [
            {
                name: 'Crispy Chicken Katsu Curry',
                description: 'Crispy panko-breaded chicken breast covered in rich aromatic katsu curry sauce on sticky white rice with pickled salad.',
                price: 13.8,
                image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'fast-food',
                prepTime: '15 mins',
            },
            {
                name: 'Steamed Chicken Gyoza (5 pcs)',
                description: 'Steamed and pan-seared dumplings served with spicy sweet soy dipping sauce.',
                price: 6.95,
                image: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'fast-food',
                prepTime: '12 mins',
            },
        ],
    },
    // ===================== ITALIAN OUTLETS (ROME) =====================
    {
        data: {
            name: 'Trattoria Da Enzo al 29',
            description: 'Autentica cucina romana: Carbonara da sogno, Cacio e Pepe, e dolci della casa fatti a mano.',
            images: {
                logo: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=300&q=80',
                cover: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
            },
            address: {
                street: 'Via dei Vascellari 29, Trastevere',
                city: 'Roma',
                state: 'Lazio',
                zipCode: '00153',
                country: 'Italy',
                countryCode: 'IT',
            },
            location: {
                type: 'Point',
                coordinates: [12.4776, 41.8872],
            },
            country: 'Italy',
            countryCode: 'IT',
            isItaly: true,
            isNigeria: false,
            isUk: false,
            cuisine: ['Pasta & Primi', 'Pasta & Trattoria', 'Trattoria & Antipasti'],
            rating: 4.9,
            numReviews: 1120,
            estimatedDeliveryTime: 25,
            deliveryFee: 2.5,
            minOrderAmount: 12,
            status: restaurant_model_1.RestaurantStatus.ACTIVE,
            openingHours: { open: '12:00', close: '23:30' },
        },
        items: [
            {
                name: 'Rigatoni alla Carbonara Autentica',
                description: 'Pasta trafilata al bronzo con guanciale laziale croccante, tuorli d’uovo freschi, Pecorino Romano DOP e pepe nero.',
                price: 13.5,
                image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'pasta-trattoria',
                prepTime: '15 mins',
            },
            {
                name: 'Tonnarelli Cacio e Pepe',
                description: 'Pasta fresca all’uovo mantecata con crema vellutata di Pecorino Romano DOP e pepe tostato in grani.',
                price: 12.0,
                image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'pasta-trattoria',
                prepTime: '15 mins',
            },
            {
                name: 'Tiramisù Artigianale al Mascarpone',
                description: 'Savoiardi sardi bagnati al caffè espresso, soffice crema al mascarpone e cacao amaro spolverato.',
                price: 6.0,
                image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'drinks-smoothies',
                prepTime: '10 mins',
            },
        ],
    },
    {
        data: {
            name: 'Pizzeria Bella Napoli Roma',
            description: 'La vera pizza napoletana a lievitazione naturale cotta nel forno a legna. Farina macinata a pietra.',
            images: {
                logo: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80',
                cover: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
            },
            address: {
                street: 'Via Nazionale 180',
                city: 'Roma',
                state: 'Lazio',
                zipCode: '00184',
                country: 'Italy',
                countryCode: 'IT',
            },
            location: {
                type: 'Point',
                coordinates: [12.4930, 41.9004],
            },
            country: 'Italy',
            countryCode: 'IT',
            isItaly: true,
            isNigeria: false,
            isUk: false,
            cuisine: ['Pizza Napoletana', 'Pizza & Bakery', 'Fast Food'],
            rating: 4.8,
            numReviews: 840,
            estimatedDeliveryTime: 20,
            deliveryFee: 2.0,
            minOrderAmount: 10,
            status: restaurant_model_1.RestaurantStatus.ACTIVE,
            openingHours: { open: '11:30', close: '23:00' },
        },
        items: [
            {
                name: 'Pizza Margherita Verace DOP',
                description: 'Pomodoro San Marzano DOP, Mozzarella di Bufala Campana, basilico fresco e olio extravergine d’oliva.',
                price: 8.5,
                image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'pizza-bakery',
                prepTime: '15 mins',
            },
            {
                name: 'Pizza Diavola con Salame Piccante',
                description: 'Pomodoro biologico, fior di latte, salame piccante calabra artigianale e peperoncino.',
                price: 10.5,
                image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'pizza-bakery',
                prepTime: '15 mins',
            },
            {
                name: 'Cannoli Siciliani alla Ricotta (2 pcs)',
                description: 'Cialda croccante ripiena di crema di ricotta fresca di pecora con gocce di cioccolato fondente e pistacchio.',
                price: 5.5,
                image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
                categorySlug: 'pizza-bakery',
                prepTime: '10 mins',
            },
        ],
    },
];
async function seed() {
    try {
        console.log('🌱 Connecting to MongoDB for seeding...');
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB.');
        // 0. Backfill existing restaurants missing country
        console.log('📌 Backfilling country fields on existing restaurants...');
        await restaurant_model_1.default.updateMany({ $or: [{ country: { $exists: false } }, { country: null }] }, { $set: { country: 'Nigeria', countryCode: 'NG', isNigeria: true, isUk: false, isItaly: false } });
        await restaurant_model_1.default.updateMany({ $or: [{ 'address.country': { $exists: false } }, { 'address.country': null }] }, { $set: { 'address.country': 'Nigeria', 'address.countryCode': 'NG' } });
        // 1. Seed/Upsert Categories
        console.log('📌 Seeding Categories...');
        await category_model_1.default.deleteMany({ isGlobal: true });
        const createdCategories = await category_model_1.default.insertMany(seedCategories);
        console.log(`✅ Seeded ${createdCategories.length} categories.`);
        const categoryMap = new Map();
        for (const c of createdCategories) {
            if (c.slug)
                categoryMap.set(c.slug, c);
        }
        // 2. Seed Vendor Owner User if not present
        let vendorOwner = await user_model_1.default.findOne({ email: 'vendor@goeatone.com' });
        if (!vendorOwner) {
            vendorOwner = await user_model_1.default.create({
                name: 'Master Vendor',
                email: 'vendor@goeatone.com',
                phoneNumber: '+2348000000001',
                password: 'Password123!',
                role: user_model_1.UserRole.VENDOR,
                isVerified: true,
            });
            console.log('👤 Created master vendor user for restaurant ownership.');
        }
        // 3. Seed Restaurants & Food Items
        console.log('📌 Seeding Restaurants & Menu Items for UK, Italy, and Nigeria...');
        for (const { data: restData, items } of seedRestaurants) {
            let restaurant = await restaurant_model_1.default.findOne({ name: restData.name });
            if (!restaurant) {
                restaurant = await restaurant_model_1.default.create({
                    ...restData,
                    owner: vendorOwner._id,
                });
                console.log(`🏪 Created restaurant: ${restaurant.name} (${restaurant.country})`);
            }
            else {
                await restaurant_model_1.default.findByIdAndUpdate(restaurant._id, restData);
                console.log(`🔄 Updated restaurant: ${restaurant.name} (${restData.country})`);
            }
            // Seed food items for this restaurant
            await foodItem_model_1.default.deleteMany({ restaurant: restaurant._id });
            const foodItemsToInsert = items.map((it) => {
                const matchedCategory = categoryMap.get(it.categorySlug) || createdCategories[0];
                return {
                    name: it.name,
                    description: it.description,
                    price: it.price,
                    image: it.image,
                    category: matchedCategory._id,
                    restaurant: restaurant._id,
                    isAvailable: true,
                    prepTime: it.prepTime,
                };
            });
            await foodItem_model_1.default.insertMany(foodItemsToInsert);
            console.log(`  🍽️ Seeded ${foodItemsToInsert.length} menu items for ${restaurant.name}.`);
        }
        console.log('\n🎉 Multi-country database seeding completed successfully!');
        process.exit(0);
    }
    catch (err) {
        console.error('❌ Database seeding failed:', err);
        process.exit(1);
    }
}
seed();
