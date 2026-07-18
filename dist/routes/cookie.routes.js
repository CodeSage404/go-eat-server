"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cookie_controller_1 = __importDefault(require("../controllers/cookie.controller"));
const router = (0, express_1.Router)();
router.post('/consent', cookie_controller_1.default.setConsent);
router.get('/consent', cookie_controller_1.default.getConsent);
exports.default = router;
