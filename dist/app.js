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
const search_routes_1 = __importDefault(require("./routes/search.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const promo_routes_1 = __importDefault(require("./routes/promo.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const support_routes_1 = __importDefault(require("./routes/support.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const upload_1 = require("./utils/upload");
const wallet_routes_1 = __importDefault(require("./routes/wallet.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const location_routes_1 = __importDefault(require("./routes/location.routes"));
const cookie_routes_1 = __importDefault(require("./routes/cookie.routes"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
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
        this.app.use('/uploads', express_1.default.static(upload_1.uploadDir));
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
        this.app.get('/api/v1/timer', (req, res) => {
            const durationInDays = 102;
            const targetDate = '2026-09-15T12:00:00Z';
            res.status(200).json({
                success: true,
                data: {
                    totalDays: durationInDays,
                    targetDate: targetDate,
                    serverTime: new Date().toISOString()
                }
            });
        });
        this.app.use('/api/v1/auth', auth_routes_1.default);
        this.app.use('/api/v1/restaurants', restaurant_routes_1.default);
        this.app.use('/api/v1/restaurants/:restaurantId/menu', menu_routes_1.default);
        this.app.use('/api/v1/orders', order_routes_1.default);
        this.app.use('/api/v1/users', user_routes_1.default);
        this.app.use('/api/v1/reviews', review_routes_1.default);
        this.app.use('/api/v1/search', search_routes_1.default);
        this.app.use('/api/v1/payments', payment_routes_1.default);
        this.app.use('/api/v1/promos', promo_routes_1.default);
        this.app.use('/api/v1/analytics', analytics_routes_1.default);
        this.app.use('/api/v1/support', support_routes_1.default);
        this.app.use('/api/v1/upload', upload_routes_1.default);
        this.app.use('/api/v1/wallets', wallet_routes_1.default);
        this.app.use('/api/v1/admin', admin_routes_1.default);
        this.app.use('/api/v1/location', location_routes_1.default);
        this.app.use('/api/v1/cookies', cookie_routes_1.default);
        // Documentation Routes
        this.app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
        this.app.get('/redoc', (req, res) => {
            res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Go-eat API Documentation</title>
            <!-- needed for adaptive design -->
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
            <style>
              body {
                margin: 0;
                padding: 0;
              }
            </style>
          </head>
          <body>
            <redoc spec-url='/swagger.json'></redoc>
            <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"> </script>
          </body>
        </html>
      `);
        });
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
        this.app.use((req, res) => {
            res.status(404).json({
                status: 'error',
                message: 'Resource not found'
            });
        });
        this.app.use((err, req, res, next) => {
            logger_1.default.error(err.stack);
            const statusCode = err.statusCode || 500;
            const status = err.status || 'error';
            res.status(statusCode).json({
                status,
                message: err.message || 'Internal Server Error',
                ...(process.env.NODE_ENV === 'development' && { error: err.message, stack: err.stack })
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
