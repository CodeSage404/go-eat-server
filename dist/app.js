"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const redis_1 = __importDefault(require("./config/redis"));
const db_1 = __importDefault(require("./config/db"));
const logger_1 = __importDefault(require("./utils/logger"));
const mongoose_1 = __importDefault(require("mongoose"));
const io_1 = require("./io");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const restaurant_routes_1 = __importDefault(require("./routes/restaurant.routes"));
const menu_routes_1 = __importDefault(require("./routes/menu.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
const redoc_express_1 = __importDefault(require("redoc-express"));
dotenv_1.default.config();
class App {
    constructor() {
        this.app = (0, express_1.default)();
        this.server = http_1.default.createServer(this.app);
        this.io = new socket_io_1.Server(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
            }
        });
        this.config();
        this.database();
        this.routes();
        this.sockets();
        this.handleErrors();
    }
    database() {
        (0, db_1.default)();
    }
    config() {
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.urlencoded({ extended: true }));
        this.app.use((0, cors_1.default)());
        this.app.use((0, helmet_1.default)());
        this.app.use((0, morgan_1.default)('dev'));
    }
    routes() {
        // Health Check
        this.app.get('/api/health', (req, res) => {
            res.status(200).json({
                status: 'success',
                message: 'Welcome to Go-eat API',
                redis: redis_1.default.isOpen ? 'connected' : 'disconnected',
                mongodb: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString()
            });
        });
        // Placeholder for API Routes
        this.app.use('/api/v1/auth', auth_routes_1.default);
        this.app.use('/api/v1/restaurants', restaurant_routes_1.default);
        this.app.use('/api/v1/restaurants/:restaurantId/menu', menu_routes_1.default);
        this.app.use('/api/v1/orders', order_routes_1.default);
        this.app.use('/api/v1/users', user_routes_1.default);
        this.app.use('/api/v1/reviews', review_routes_1.default);
        // Documentation Routes
        this.app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
        this.app.get('/redoc', (0, redoc_express_1.default)({
            title: 'Go-eat API Docs',
            specUrl: '/swagger.json'
        }));
        // Serve swagger spec as JSON
        this.app.get('/swagger.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(swagger_1.swaggerSpec);
        });
        this.app.get('/', (req, res) => {
            res.json({ message: 'Welcome to Go-eat API' });
        });
    }
    sockets() {
        (0, io_1.handleSocketEvents)(this.io);
    }
    handleErrors() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                status: 'error',
                message: 'Resource not found'
            });
        });
        // Global error handler
        this.app.use((err, req, res, next) => {
            logger_1.default.error(err.stack);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        });
    }
    listen(port) {
        this.server.listen(port, () => {
            logger_1.default.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${port}`);
        });
    }
}
exports.default = new App();
