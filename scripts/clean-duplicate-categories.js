/**
 * Standalone CLI script to clean up duplicate Categories in MongoDB
 * Usage: node scripts/clean-duplicate-categories.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/go-eat';

const runCleanup = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(dbUrl);
    console.log('Connected to MongoDB successfully!');

    const Category = mongoose.connection.collection('categories');
    const FoodItem = mongoose.connection.collection('fooditems');

    // Sort so global categories come first, then oldest createdAt
    const categories = await Category.find().sort({ isGlobal: -1, createdAt: 1 }).toArray();
    console.log(`Found ${categories.length} total categories.`);

    const seen = new Map();
    const toDeleteIds = [];
    const replaceMap = new Map();

    for (const cat of categories) {
      const key = (cat.name || '').trim().toLowerCase();

      if (seen.has(key)) {
        const primary = seen.get(key);
        toDeleteIds.push(cat._id);
        replaceMap.set(cat._id.toString(), primary._id);
        console.log(`[DUPLICATE DETECTED] "${cat.name}" (ID: ${cat._id}) -> duplicate of primary ID: ${primary._id}`);
      } else {
        seen.set(key, cat);
      }
    }

    if (toDeleteIds.length === 0) {
      console.log('✅ No duplicate categories found in DB!');
      await mongoose.disconnect();
      return;
    }

    console.log(`Found ${toDeleteIds.length} duplicate categories to clean up.`);

    for (const [dupIdStr, primaryId] of replaceMap.entries()) {
      const dupId = new mongoose.Types.ObjectId(dupIdStr);
      const res = await FoodItem.updateMany(
        { category: dupId },
        { $set: { category: primaryId } }
      );
      if (res.modifiedCount > 0) {
        console.log(`Migrated ${res.modifiedCount} food items from duplicate category ${dupIdStr} to primary ${primaryId}`);
      }
    }

    const delRes = await Category.deleteMany({ _id: { $in: toDeleteIds } });
    console.log(`✅ Successfully deleted ${delRes.deletedCount} duplicate categories from MongoDB!`);

    await mongoose.disconnect();
    console.log('Database connection closed.');
  } catch (err) {
    console.error('Error cleaning duplicate categories:', err);
    process.exit(1);
  }
};

runCleanup();
