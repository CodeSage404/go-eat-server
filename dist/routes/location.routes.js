"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const location_controller_1 = __importDefault(require("../controllers/location.controller"));
const router = (0, express_1.Router)();
router.get('/nigeria-states', location_controller_1.default.getNigeriaStates);
router.get('/autocomplete', location_controller_1.default.autocomplete);
router.get('/detect', location_controller_1.default.detectLocation);
exports.default = router;
