"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const db_1 = __importDefault(require("../config/db"));
const user_model_1 = __importDefault(require("../models/user.model"));
const notification_service_1 = __importDefault(require("../services/notification.service"));
async function run() {
    try {
        await (0, db_1.default)();
        console.log(' Connected to Database');
        const email = 'echinecherem729@gmail.com';
        const user = await user_model_1.default.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.log(`? User with email "${email}" not found in database.`);
            const allUsers = await user_model_1.default.find({}, 'email phoneNumber name fcmToken role').limit(10);
            console.log('Existing users sample:', allUsers);
            process.exit(1);
        }
        console.log(`? Found user: ${user.name || 'No Name'} (${user.email})`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Notifications Enabled: ${user.notificationsEnabled}`);
        console.log(`   Push/FCM Token: ${user.fcmToken || 'NO TOKEN REGISTERED'}`);
        console.log('?? Sending push notification...');
        await notification_service_1.default.sendNotification(user._id.toString(), 'Go-Eat Test Notification ??', 'Hello! Your Go-Eat push notification service is working properly.', { type: 'TEST', timestamp: new Date().toISOString() });
        console.log('?? Notification processed successfully!');
        setTimeout(() => process.exit(0), 2000);
    }
    catch (err) {
        console.error('? Error testing push notification:', err.message || err);
        process.exit(1);
    }
}
run();
