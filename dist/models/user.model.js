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
exports.UserStatus = exports.UserRole = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
var UserRole;
(function (UserRole) {
    UserRole["CUSTOMER"] = "customer";
    UserRole["VENDOR"] = "vendor";
    UserRole["RIDER"] = "rider";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["PENDING"] = "pending";
    UserStatus["SUSPENDED"] = "suspended";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
const userSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Please provide your email'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 8,
        select: false, // Don't return password by default
    },
    role: {
        type: String,
        enum: Object.values(UserRole),
        default: UserRole.CUSTOMER,
    },
    status: {
        type: String,
        enum: Object.values(UserStatus),
        default: UserStatus.ACTIVE,
    },
    phoneNumber: {
        type: String,
        trim: true,
    },
    profileImage: {
        type: String,
        default: 'default-profile.png',
    },
    fcmToken: {
        type: String,
        trim: true,
    },
    notificationsEnabled: {
        type: Boolean,
        default: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    appleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    isOnline: {
        type: Boolean,
        default: false,
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
        },
        coordinates: {
            type: [Number],
        },
    },
    savedAddresses: [
        {
            label: { type: String, required: true }, // e.g., 'Home', 'Work'
            address: { type: String, required: true },
            location: {
                type: {
                    type: String,
                    enum: ['Point'],
                    default: 'Point',
                },
                coordinates: [Number],
            },
            isDefault: { type: Boolean, default: false },
        },
    ],
}, {
    timestamps: true,
});
// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password'))
        return;
    this.password = await bcryptjs_1.default.hash(this.password, 12);
});
// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcryptjs_1.default.compare(candidatePassword, this.password);
};
// Index for geospatial queries (rider tracking)
userSchema.index({ location: '2dsphere' });
const User = mongoose_1.default.model('User', userSchema);
exports.default = User;
