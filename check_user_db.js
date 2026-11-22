const mongoose = require("mongoose");
const uri = "mongodb://echinecherem72999_db_user:eCQgKFC5TyX5QU7W@ac-hjwrplp-shard-00-00.dupeyhe.mongodb.net:27017,ac-hjwrplp-shard-00-01.dupeyhe.mongodb.net:27017,ac-hjwrplp-shard-00-02.dupeyhe.mongodb.net:27017/go-eat?ssl=true&authSource=admin&replicaSet=atlas-7z6wgk-shard-0";

async function run() {
  await mongoose.connect(uri);
  const email = "echinecherem72999@gmail.com";
  
  const User = mongoose.connection.collection("users");
  const users = await User.find({ email }).toArray();
  console.log("Users found:", JSON.stringify(users.map(u => ({
    id: u._id,
    name: u.name,
    email: u.email,
    phoneNumber: u.phoneNumber,
    role: u.role,
    status: u.status,
    isVerified: u.isVerified,
    createdAt: u.createdAt
  })), null, 2));

  const PartnerApp = mongoose.connection.collection("partnerapplications");
  const apps = await PartnerApp.find({ email }).toArray();
  console.log("Partner Applications found:", JSON.stringify(apps.map(a => ({
    id: a._id,
    businessName: a.businessName,
    email: a.email,
    phoneNumber: a.phoneNumber,
    status: a.status,
    applicationType: a.applicationType,
    createdAt: a.createdAt
  })), null, 2));

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
