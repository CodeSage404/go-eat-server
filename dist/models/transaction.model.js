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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionStatus = exports.TransactionType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var TransactionType;
(function (TransactionType) {
    TransactionType["EARNING"] = "earning";
    TransactionType["SETTLEMENT"] = "settlement";
    TransactionType["COMMISSION"] = "commission";
    TransactionType["WITHDRAWAL"] = "withdrawal";
    TransactionType["CANCELLATION_COMPENSATION"] = "cancellation_compensation";
    TransactionType["REFUND"] = "refund";
    TransactionType["HOLD"] = "hold";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "pending";
    TransactionStatus["COMPLETED"] = "completed";
    TransactionStatus["FAILED"] = "failed";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
const transactionSchema = new mongoose_1.Schema({
    wallet: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Wallet',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    type: {
        type: String,
        enum: Object.values(TransactionType),
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(TransactionStatus),
        default: TransactionStatus.PENDING,
    },
    description: {
        type: String,
        required: true,
    },
    reference: {
        type: String,
    },
}, {
    timestamps: true,
});
const Transaction = mongoose_1.default.model('Transaction', transactionSchema);
exports.default = Transaction;
