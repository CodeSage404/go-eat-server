import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

import User, { UserRole, UserStatus } from '../src/models/user.model';
import Restaurant, { RestaurantStatus } from '../src/models/restaurant.model';
import Category from '../src/models/category.model';
import FoodItem from '../src/models/foodItem.model';
import Order, { OrderStatus, PaymentMethod } from '../src/models/order.model';
import Review from '../src/models/review.model';
import AuditLog from '../src/models/auditLog.model';
import SystemLog from '../src/models/systemLog.model';
import Booking from '../src/models/booking.model';
import Wallet from '../src/models/wallet.model';
import Transaction from '../src/models/transaction.model';
import RolePermission from '../src/models/role.model';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/go-eat';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@goeat.com').toLowerCase();

async function seed() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully!');

    // 1. Clear previous mock records
    console.log('Cleaning up database...');
    // Delete all users except Admin
    await User.deleteMany({ email: { $ne: ADMIN_EMAIL } });
    await Restaurant.deleteMany({});
    await Category.deleteMany({});
    await FoodItem.deleteMany({});
    await Order.deleteMany({});
    await Review.deleteMany({});
    await AuditLog.deleteMany({});
    await SystemLog.deleteMany({});
    await Booking.deleteMany({});
    await Wallet.deleteMany({});
    await Transaction.deleteMany({});
    await RolePermission.deleteMany({});
    console.log('Previous mock data cleared.');

    // 2. Create Users
    console.log('Seeding users...');
    
    // Customers
    const customers = await User.create([
      {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        phoneNumber: '+2348011111111',
        isVerified: true,
      },
      {
        name: 'Chinedu Obi',
        email: 'chinedu@example.com',
        password: 'Password123!',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        phoneNumber: '+2348022222222',
        isVerified: true,
      },
      {
        name: 'Amina Bello',
        email: 'amina@example.com',
        password: 'Password123!',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        phoneNumber: '+2348033333333',
        isVerified: true,
      },
      {
        name: 'Sarah Jenkins',
        email: 'sarah@example.com',
        password: 'Password123!',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        phoneNumber: '+2348044444444',
        isVerified: true,
      },
      {
        name: 'Tunde Bakare',
        email: 'tunde@example.com',
        password: 'Password123!',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        phoneNumber: '+2348055555555',
        isVerified: true,
      }
    ]);

    // Vendors
    const vendors = await User.create([
      {
        name: 'Mama Ngozi',
        email: 'ngozi@vendor.com',
        password: 'Password123!',
        role: UserRole.VENDOR,
        status: UserStatus.ACTIVE,
        phoneNumber: '+2348066666666',
        isVerified: true,
      },
      {
        name: 'Kebab Master',
        email: 'kebab@vendor.com',
        password: 'Password123!',
        role: UserRole.VENDOR,
        status: UserStatus.ACTIVE,
        phoneNumber: '+2348077777777',
        isVerified: true,
      },
      {
        name: 'Pizza Place Owner',
        email: 'pizza@vendor.com',
        password: 'Password123!',
        role: UserRole.VENDOR,
        status: UserStatus.ACTIVE,
        phoneNumber: '+2348088888888',
        isVerified: true,
      }
    ]);

    // Riders
    const riders = await User.create([
      {
        name: 'Rider Swift',
        email: 'swift@rider.com',
        password: 'Password123!',
        role: UserRole.RIDER,
        status: UserStatus.ACTIVE,
        phoneNumber: '+2348099999999',
        isVerified: true,
      },
      {
        name: 'Rider Flash',
        email: 'flash@rider.com',
        password: 'Password123!',
        role: UserRole.RIDER,
        status: UserStatus.ACTIVE,
        phoneNumber: '+2348010101010',
        isVerified: true,
      }
    ]);

    console.log('Seeded users successfully.');

    // 3. Create Restaurants
    console.log('Seeding restaurants...');
    const restaurant1 = await Restaurant.create({
      owner: vendors[0]._id,
      name: "Mama Ngozi's Kitchen",
      description: 'Authentic Nigerian local delicacies, soups, and grills.',
      address: {
        street: '12 Herbert Macaulay Way',
        city: 'Yaba',
        state: 'Lagos',
        zipCode: '100001'
      },
      location: {
        type: 'Point',
        coordinates: [3.3792, 6.5158] // Yaba, Lagos
      },
      cuisine: ['Nigerian', 'Traditional', 'African'],
      rating: 4.8,
      numReviews: 12,
      openingHours: { open: '08:00', close: '21:00' },
      images: {
        logo: 'default-logo.png',
        cover: 'default-cover.png'
      },
      deliveryFee: 800,
      minOrderAmount: 1500,
      estimatedDeliveryTime: 25,
      isSelfPickup: true,
      status: RestaurantStatus.ACTIVE,
    });

    const restaurant2 = await Restaurant.create({
      owner: vendors[1]._id,
      name: 'Kebab & Shawarma Master',
      description: 'Delicious hot shawarmas, wraps, kebabs and fresh fries.',
      address: {
        street: '45 Admiralty Way',
        city: 'Lekki Phase 1',
        state: 'Lagos',
        zipCode: '105102'
      },
      location: {
        type: 'Point',
        coordinates: [3.4692, 6.4358] // Lekki, Lagos
      },
      cuisine: ['Halal', 'Middle Eastern', 'Grill', 'Fast Food'],
      rating: 4.5,
      numReviews: 8,
      openingHours: { open: '10:00', close: '23:00' },
      images: {
        logo: 'default-logo.png',
        cover: 'default-cover.png'
      },
      deliveryFee: 1200,
      minOrderAmount: 2000,
      estimatedDeliveryTime: 35,
      isSelfPickup: true,
      status: RestaurantStatus.ACTIVE,
    });

    const restaurant3 = await Restaurant.create({
      owner: vendors[2]._id,
      name: 'Bella Pizza & Pasta',
      description: 'Fresh woodfired pizzas, lasagna, pasta and desserts.',
      address: {
        street: '88 Joel Ogunnaike St',
        city: 'Ikeja GRA',
        state: 'Lagos',
        zipCode: '100271'
      },
      location: {
        type: 'Point',
        coordinates: [3.3592, 6.5858] // Ikeja, Lagos
      },
      cuisine: ['Italian', 'Pizza', 'Pasta', 'Desserts'],
      rating: 4.2,
      numReviews: 15,
      openingHours: { open: '11:00', close: '22:00' },
      images: {
        logo: 'default-logo.png',
        cover: 'default-cover.png'
      },
      deliveryFee: 1000,
      minOrderAmount: 2500,
      estimatedDeliveryTime: 40,
      isSelfPickup: false,
      status: RestaurantStatus.PENDING, // This one is pending for testing approve flow!
    });

    console.log('Seeded restaurants successfully.');

    // 4. Create Categories and FoodItems
    console.log('Seeding categories and food items...');
    
    // Categories for Ngozi
    const catNgozi1 = await Category.create({ name: 'Soups & Swallows', restaurant: restaurant1._id, order: 1 });
    const catNgozi2 = await Category.create({ name: 'Rice Dishes', restaurant: restaurant1._id, order: 2 });

    const foodNgozi = await FoodItem.create([
      {
        name: 'Egusi Soup with Pounded Yam',
        description: 'Rich melon seed soup with fresh vegetables, assorted meats, served with pounded yam.',
        price: 3500,
        category: catNgozi1._id,
        restaurant: restaurant1._id,
        isAvailable: true,
      },
      {
        name: 'Jollof Rice Special',
        description: 'Smoky party jollof rice served with fried plantain and seasoned peppered chicken.',
        price: 4000,
        category: catNgozi2._id,
        restaurant: restaurant1._id,
        isAvailable: true,
      },
      {
        name: 'Ofada Rice and Sauce',
        description: 'Local unpolished rice served with spicy green pepper sauce, boiled egg, and beef.',
        price: 4500,
        category: catNgozi2._id,
        restaurant: restaurant1._id,
        isAvailable: true,
      }
    ]);

    // Categories for Kebab Master
    const catKebab1 = await Category.create({ name: 'Shawarma & Wraps', restaurant: restaurant2._id, order: 1 });
    const catKebab2 = await Category.create({ name: 'Sides & Fries', restaurant: restaurant2._id, order: 2 });

    const foodKebab = await FoodItem.create([
      {
        name: 'Double Chicken Shawarma',
        description: 'Grilled spiced chicken wrapped in flatbread with cabbage, sausages, and garlic mayo.',
        price: 2500,
        category: catKebab1._id,
        restaurant: restaurant2._id,
        isAvailable: true,
      },
      {
        name: 'Beef Kofta Wrap',
        description: 'Minced beef kebab wraps with onions, tomatoes, and spicy sauce.',
        price: 2800,
        category: catKebab1._id,
        restaurant: restaurant2._id,
        isAvailable: true,
      },
      {
        name: 'Large Cheesy Fries',
        description: 'Thick cut crispy golden french fries loaded with melted cheddar cheese.',
        price: 1800,
        category: catKebab2._id,
        restaurant: restaurant2._id,
        isAvailable: true,
      }
    ]);

    // Categories for Pizza Place
    const catPizza1 = await Category.create({ name: 'Pizza', restaurant: restaurant3._id, order: 1 });
    const catPizza2 = await Category.create({ name: 'Desserts', restaurant: restaurant3._id, order: 2 });

    const foodPizza = await FoodItem.create([
      {
        name: 'Pepperoni Supreme Pizza',
        description: 'Classic mozzarella, tomato sauce, and double pepperoni slices on hand-tossed dough.',
        price: 6500,
        category: catPizza1._id,
        restaurant: restaurant3._id,
        isAvailable: true,
      },
      {
        name: 'Spicy Margherita Pizza',
        description: 'Fresh basil leaves, tomatoes, garlic, buffalo mozzarella, and a kick of chili oil.',
        price: 5500,
        category: catPizza1._id,
        restaurant: restaurant3._id,
        isAvailable: true,
      },
      {
        name: 'Chocolate Lava Cake',
        description: 'Warm chocolate cake with a molten chocolate center, served with vanilla scoop.',
        price: 2200,
        category: catPizza2._id,
        restaurant: restaurant3._id,
        isAvailable: true,
      }
    ]);

    console.log('Seeded categories and food items successfully.');

    // 5. Create Orders (distributed over the last 7 days)
    console.log('Seeding orders...');
    
    const today = new Date();
    const daysToSeed = 7;
    const orderStatuses = [
      OrderStatus.DELIVERED,
      OrderStatus.DELIVERED,
      OrderStatus.DELIVERED,
      OrderStatus.DELIVERED,
      OrderStatus.DELIVERED,
      OrderStatus.DELIVERED,
      OrderStatus.PENDING,
      OrderStatus.ACCEPTED,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.CANCELLED
    ];

    const orderData = [];

    // Let's generate 28 orders (4 per day)
    for (let dayOffset = 0; dayOffset < daysToSeed; dayOffset++) {
      const orderDate = new Date();
      orderDate.setDate(today.getDate() - dayOffset);
      
      // Ensure times are spread during the day (e.g. lunch/dinner)
      for (let i = 0; i < 4; i++) {
        const hour = 11 + i * 2.5; // 11:00, 13:30, 16:00, 18:30
        orderDate.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

        // Pick random customer
        const customer = customers[Math.floor(Math.random() * customers.length)];
        
        // Pick random restaurant (Mama Ngozi or Kebab Master)
        // Let's use active restaurants for most orders, pizza for a few
        const usePizza = Math.random() < 0.15;
        const targetRest = usePizza ? restaurant3 : (Math.random() < 0.5 ? restaurant1 : restaurant2);
        
        // Find food items for this restaurant
        let restFoods;
        if (targetRest._id.equals(restaurant1._id)) restFoods = foodNgozi;
        else if (targetRest._id.equals(restaurant2._id)) restFoods = foodKebab;
        else restFoods = foodPizza;

        // Select 1 or 2 items
        const numItems = Math.random() < 0.7 ? 1 : 2;
        const selectedItems = [];
        let subtotal = 0;

        for (let k = 0; k < numItems; k++) {
          const item = restFoods[Math.floor(Math.random() * restFoods.length)];
          const qty = Math.random() < 0.8 ? 1 : 2;
          
          selectedItems.push({
            foodItem: item._id,
            name: item.name,
            price: item.price,
            quantity: qty
          });
          subtotal += item.price * qty;
        }

        const deliveryFee = targetRest.deliveryFee;
        const totalAmount = subtotal + deliveryFee;

        // Randomize status based on how old the order is
        // Orders today/yesterday can be pending/preparing/cancelled/delivered.
        // Orders older than 2 days are almost always delivered or cancelled.
        let status = OrderStatus.DELIVERED;
        if (dayOffset === 0) {
          status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
        } else if (dayOffset === 1) {
          status = Math.random() < 0.8 ? OrderStatus.DELIVERED : OrderStatus.CANCELLED;
        } else {
          status = Math.random() < 0.9 ? OrderStatus.DELIVERED : OrderStatus.CANCELLED;
        }

        const rider = status === OrderStatus.DELIVERED || status === OrderStatus.OUT_FOR_DELIVERY 
          ? riders[Math.floor(Math.random() * riders.length)]._id 
          : undefined;

        orderData.push({
          customer: customer._id,
          restaurant: targetRest._id,
          rider: rider,
          items: selectedItems,
          totalAmount: totalAmount,
          deliveryFee: deliveryFee,
          deliveryAddress: {
            street: customer.name === 'John Doe' ? '30 Yaba Close' : '10 Lekki Phase 1 Rd',
            city: 'Lagos',
            state: 'Lagos',
            zipCode: '100001',
            coordinates: [3.3792, 6.5158]
          },
          paymentMethod: PaymentMethod.CARD,
          paymentStatus: status === OrderStatus.DELIVERED ? 'completed' : (status === OrderStatus.CANCELLED ? 'failed' : 'pending'),
          status: status,
          createdAt: new Date(orderDate),
          updatedAt: new Date(orderDate)
        });
      }
    }

    console.log(`Inserting ${orderData.length} mock orders...`);
    await Order.insertMany(orderData);
    console.log('Mock orders inserted successfully.');

    // Seed reviews
    console.log('Seeding reviews...');
    const insertedOrders = await Order.find({ status: OrderStatus.DELIVERED });
    const reviews = [];
    const reviewComments = [
      'Amazing food! Delivery was super fast.',
      'The smoky flavor of the Jollof was incredible.',
      'Delicious meal, would definitely order again!',
      'Great portion size and the packing was neat.',
      'Spicy and authentic flavor. Love it!',
      'Excellent customer service and tasty pizza!',
      'Not bad, but delivery took a bit longer than expected.',
      'Best Shawarma in town, hands down!',
      'Food was delivered hot and fresh. Five stars!'
    ];

    for (let idx = 0; idx < insertedOrders.length; idx++) {
      const order = insertedOrders[idx];
      // Create a review for about 60% of delivered orders
      if (Math.random() < 0.6) {
        reviews.push({
          user: order.customer,
          restaurant: order.restaurant,
          order: order._id,
          rating: Math.floor(Math.random() * 2) + 4, // 4 or 5 rating
          comment: reviewComments[Math.floor(Math.random() * reviewComments.length)]
        });
      }
    }
    await Review.insertMany(reviews);
    console.log(`Seeded ${reviews.length} reviews.`);

    // Update restaurant ratings
    console.log('Updating restaurant average ratings...');
    const restaurants = await Restaurant.find({});
    for (const rest of restaurants) {
      const stats = await Review.aggregate([
        { $match: { restaurant: rest._id } },
        {
          $group: {
            _id: '$restaurant',
            nRating: { $sum: 1 },
            avgRating: { $avg: '$rating' },
          },
        },
      ]);
      if (stats.length > 0) {
        rest.rating = Math.round(stats[0].avgRating * 10) / 10;
        rest.numReviews = stats[0].nRating;
        await rest.save();
      }
    }
    console.log('Updated restaurant average ratings.');

    // Seed Audit Logs
    console.log('Seeding audit logs...');
    const auditActions = [
      { user: 'Admin (Divine)', action: 'Suspended restaurant Rice Republic', category: 'Restaurant' },
      { user: 'Admin (Divine)', action: 'Approved restaurant Bella Pizza & Pasta', category: 'Restaurant' },
      { user: 'Admin (Divine)', action: 'Updated user account status for John Doe', category: 'User' },
      { user: 'Admin (Divine)', action: 'Reset super-admin password', category: 'Auth' },
      { user: 'Admin (Divine)', action: 'Created new manual restaurant: Burger Central', category: 'Restaurant' },
      { user: 'Vendor (Mama Ngozi)', action: 'Added food item: Peppered Fish', category: 'Menu' },
      { user: 'Vendor (Mama Ngozi)', action: 'Updated status of Smoky Jollof to unavailable', category: 'Menu' },
      { user: 'Rider Swift', action: 'Accepted order delivery job #ORD1024', category: 'Order' },
      { user: 'Admin (Divine)', action: 'Logged in to super-admin dashboard', category: 'Auth' }
    ];

    const auditLogsToInsert = [];
    const seedDate = new Date();
    for (let i = 0; i < 20; i++) {
      const actionTemplate = auditActions[Math.floor(Math.random() * auditActions.length)];
      const logDate = new Date();
      logDate.setHours(seedDate.getHours() - i * 4); // Spread over past days
      auditLogsToInsert.push({
        user: actionTemplate.user,
        action: actionTemplate.action,
        category: actionTemplate.category,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
        status: 'success',
        createdAt: logDate
      });
    }
    await AuditLog.insertMany(auditLogsToInsert);
    console.log('Seeded audit logs.');

    // Seed System Logs
    console.log('Seeding system logs...');
    const systemLogTemplates = [
      { level: 'info', message: 'MongoDB connection established successfully', service: 'api-service' },
      { level: 'info', message: 'Redis cache connected on port 6379', service: 'cache-service' },
      { level: 'info', message: 'Express server listening on port 5000', service: 'api-service' },
      { level: 'info', message: 'Incoming webhook received from Paystack', service: 'payment-service' },
      { level: 'debug', message: 'JWT verification passed for user ID 65d70f0...', service: 'auth-service' },
      { level: 'warn', message: 'Redis memory limit reaching 80% threshold', service: 'cache-service' },
      { level: 'error', message: 'Failed to send transactional SMS to +2348033333333: Twilio balance low', service: 'notification-service' },
      { level: 'info', message: 'Successfully sent order confirmation email to customer', service: 'notification-service' },
      { level: 'info', message: 'Wallet balance updated for vendor NGOZI', service: 'wallet-service' }
    ];

    const systemLogsToInsert = [];
    for (let i = 0; i < 30; i++) {
      const template = systemLogTemplates[Math.floor(Math.random() * systemLogTemplates.length)];
      const logDate = new Date();
      logDate.setMinutes(seedDate.getMinutes() - i * 15); // Spread over past hours
      systemLogsToInsert.push({
        level: template.level,
        message: template.message,
        service: template.service,
        createdAt: logDate
      });
    }
    await SystemLog.insertMany(systemLogsToInsert);
    console.log('Seeded system logs.');

    // Seeding Wallets
    console.log('Seeding wallets...');
    const vendorWallets = await Wallet.create(
      vendors.map((v, i) => ({
        user: v._id,
        balance: [150000, 240000, 0][i] || 50000,
        currency: 'NGN',
        isActive: true,
      }))
    );
    const riderWallets = await Wallet.create(
      riders.map((r, i) => ({
        user: r._id,
        balance: [12000, 4500][i] || 2000,
        currency: 'NGN',
        isActive: true,
      }))
    );
    console.log('Seeded wallets successfully.');

    // Seeding Transactions
    console.log('Seeding transactions...');
    const transactions = [];
    const ngoziWallet = vendorWallets[0];
    const swiftWallet = riderWallets[0];

    transactions.push(
      {
        wallet: ngoziWallet._id,
        amount: 8500,
        type: 'earning',
        status: 'completed',
        description: 'Earning for Order #GO12543',
        reference: 'TXN-NGN-001',
        createdAt: new Date(seedDate.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        wallet: ngoziWallet._id,
        amount: 45000,
        type: 'withdrawal',
        status: 'completed',
        description: 'Weekly payout to Access Bank',
        reference: 'TXN-NGN-002',
        createdAt: new Date(seedDate.getTime() - 4 * 24 * 60 * 60 * 1000),
      },
      {
        wallet: ngoziWallet._id,
        amount: 12000,
        type: 'earning',
        status: 'completed',
        description: 'Earning for Order #GO12545',
        reference: 'TXN-NGN-003',
        createdAt: new Date(seedDate.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        wallet: swiftWallet._id,
        amount: 1200,
        type: 'earning',
        status: 'completed',
        description: 'Delivery fee for Order #GO12543',
        reference: 'TXN-NGN-004',
        createdAt: new Date(seedDate.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        wallet: swiftWallet._id,
        amount: 5000,
        type: 'withdrawal',
        status: 'pending',
        description: 'Payout to OPay account',
        reference: 'TXN-NGN-005',
        createdAt: new Date(seedDate.getTime() - 12 * 60 * 60 * 1000),
      }
    );
    await Transaction.insertMany(transactions);
    console.log('Seeded transactions successfully.');

    // Seeding Bookings
    console.log('Seeding table bookings...');
    const bookingsToInsert = [
      {
        customer: customers[0]._id,
        restaurant: restaurant1._id,
        bookingDate: new Date(seedDate.getTime() + 1 * 24 * 60 * 60 * 1000),
        bookingTime: '08:00 AM',
        numberOfGuests: 2,
        status: 'confirmed',
        specialRequests: 'Window seat if possible, vegetarian options.',
      },
      {
        customer: customers[1]._id,
        restaurant: restaurant1._id,
        bookingDate: new Date(seedDate.getTime() + 1 * 24 * 60 * 60 * 1000),
        bookingTime: '10:00 AM',
        numberOfGuests: 4,
        status: 'pending',
        specialRequests: 'Birthday dinner setup.',
      },
      {
        customer: customers[2]._id,
        restaurant: restaurant2._id,
        bookingDate: new Date(seedDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        bookingTime: '12:00 PM',
        numberOfGuests: 3,
        status: 'confirmed',
        specialRequests: '',
      },
      {
        customer: customers[0]._id,
        restaurant: restaurant3._id,
        bookingDate: new Date(seedDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        bookingTime: '01:00 PM',
        numberOfGuests: 2,
        status: 'cancelled',
        specialRequests: 'Table close to the grill.',
      }
    ];
    await Booking.insertMany(bookingsToInsert);
    console.log('Seeded bookings successfully.');

    // Seeding Roles & Permissions
    console.log('Seeding roles & permissions...');
    const rolesToInsert = [
      {
        roleName: 'admin',
        permissions: [
          'users.create', 'users.read', 'users.update', 'users.delete', 'users.suspend',
          'restaurants.approve', 'restaurants.suspend', 'restaurants.crud',
          'orders.read', 'orders.dispatch',
          'payouts.manage', 'analytics.view',
          'promo.manage', 'notifications.broadcast'
        ]
      },
      {
        roleName: 'vendor',
        permissions: [
          'orders.read', 'orders.accept', 'orders.status',
          'menu.crud', 'restaurant.profile'
        ]
      },
      {
        roleName: 'rider',
        permissions: [
          'orders.delivery', 'rider.availability', 'earnings.view'
        ]
      }
    ];
    await RolePermission.insertMany(rolesToInsert);
    console.log('Seeded roles & permissions successfully.');

    console.log('✨ Data seeding completed successfully! ✨');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Mongoose connection closed.');
    process.exit(0);
  }
}

seed();
