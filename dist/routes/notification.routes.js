"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = __importDefault(require("../controllers/notification.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All notification routes require authentication
router.use(auth_middleware_1.protect);
router.get('/', notification_controller_1.default.getMyNotifications);
router.patch('/read-all', notification_controller_1.default.markAllAsRead);
router.patch('/:id/read', notification_controller_1.default.markAsRead);
exports.default = router;
