import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function run() {
  const logoPath = path.join(__dirname, '../logo.png');
  console.log(`Uploading logo from: ${logoPath}...`);

  try {
    const result = await cloudinary.uploader.upload(logoPath, {
      public_id: 'go_eat_logo',
      folder: 'go_eat',
      overwrite: true,
      resource_type: 'image',
    });

    console.log('\n✅ Logo uploaded to Cloudinary successfully!');
    console.log('Public ID:', result.public_id);
    console.log('Secure URL:', result.secure_url);
  } catch (err: any) {
    console.error('❌ Cloudinary upload failed:', err.message || err);
  }
}

run();
