import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

const mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/go-eat';

async function run() {
  console.log('Connecting to MongoDB...');
  try {
    const conn = await mongoose.connect(mongodbUri);
    console.log('Connected!');

    const db = conn.connection.db;
    if (!db) {
      throw new Error('Database object undefined');
    }

    const collections = await db.listCollections().toArray();
    const usersExists = collections.some(col => col.name === 'users');

    if (!usersExists) {
      console.log('Users collection does not exist yet. No indexes to fix.');
      process.exit(0);
    }

    const usersCollection = conn.connection.collection('users');
    const indexes = await usersCollection.indexes();
    console.log('Current indexes on users collection:', indexes);

    const emailIndex = indexes.find(idx => idx.name === 'email_1');
    if (emailIndex) {
      console.log('Found email_1 index:', emailIndex);
      if (!emailIndex.sparse) {
        console.log('Index is not sparse. Dropping index email_1...');
        await usersCollection.dropIndex('email_1');
        console.log('Index email_1 dropped successfully!');
      } else {
        console.log('Index email_1 is already sparse. No action needed.');
      }
    } else {
      console.log('Index email_1 does not exist.');
    }

    const phoneIndex = indexes.find(idx => idx.name === 'phoneNumber_1');
    if (phoneIndex) {
      console.log('Found phoneNumber_1 index:', phoneIndex);
      if (!phoneIndex.sparse) {
        console.log('Index is not sparse. Dropping index phoneNumber_1...');
        await usersCollection.dropIndex('phoneNumber_1');
        console.log('Index phoneNumber_1 dropped successfully!');
      } else {
        console.log('Index phoneNumber_1 is already sparse. No action needed.');
      }
    }

    console.log('Database indexes checked and repaired successfully!');
    process.exit(0);
  } catch (err: any) {
    console.error('Database fix script failed:', err.message);
    process.exit(1);
  }
}

run();
