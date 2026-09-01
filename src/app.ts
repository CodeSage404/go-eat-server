import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitizeMiddleware from './middleware/sanitize.middleware';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import redisClient from './config/redis';
import connectDB from './config/db';
import logger from './utils/logger';
import mongoose from 'mongoose';
import { handleSocketEvents } from './io';

import authRoutes from './routes/auth.routes';
import restaurantRoutes from './routes/restaurant.routes';
import menuRoutes from './routes/menu.routes';
import orderRoutes from './routes/order.routes';
import userRoutes from './routes/user.routes';
import reviewRoutes from './routes/review.routes';
import searchRoutes from './routes/search.routes';
import paymentRoutes from './routes/payment.routes';
import promoRoutes from './routes/promo.routes';
import analyticsRoutes from './routes/analytics.routes';
import supportRoutes from './routes/support.routes';
import uploadRoutes from './routes/upload.routes';
import { uploadDir } from './utils/upload';
import walletRoutes from './routes/wallet.routes';
import adminRoutes from './routes/admin.routes';
import locationRoutes from './routes/location.routes';
import categoryRoutes from './routes/category.routes';
import foodItemRoutes from './routes/food-item.routes';
import cookieRoutes from './routes/cookie.routes';
import cartRoutes from './routes/cart.routes';
import onboardingRoutes from './routes/onboarding.routes';
import documentRoutes from './routes/document.routes';
import staffRoutes from './routes/staff.routes';
import notificationRoutes from './routes/notification.routes';
import { startKeepAlivePing } from './utils/keepAlive';

import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

dotenv.config();

class App {
  public app: Application;
  public server: http.Server;
  public io: Server;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
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

  private database(): void {
    connectDB();
  }

  private config(): void {
    this.app.use(express.json({ limit: '2mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '2mb' }));
    this.app.use(mongoSanitizeMiddleware);
    this.app.use(cors());
    this.app.use(helmet());
    this.app.use(morgan('dev'));
    this.app.use('/uploads', express.static(uploadDir));
  }

  private routes(): void {
    // Health Check
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'success',
        message: 'Welcome to Go-eat API',
        redis: redisClient.isOpen ? 'connected' : 'disconnected',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/api/v1/timer', (req: Request, res: Response) => {
      // 1 month (30 days) + 30 days = 60 days total countdown duration
      const totalDays = 60;
      const targetDate = new Date(Date.now() + totalDays * 24 * 60 * 60 * 1000).toISOString();

      res.status(200).json({
        success: true,
        data: {
          totalDays,
          targetDate, 
          serverTime: new Date().toISOString()
        }
      });
    });

    this.app.use('/api/v1/auth', authRoutes);
    this.app.use('/api/v1/restaurants', restaurantRoutes);
    this.app.use('/api/v1/restaurants/:restaurantId/menu', menuRoutes);
    this.app.use('/api/v1/orders', orderRoutes);
    this.app.use('/api/v1/users', userRoutes);
    this.app.use('/api/v1/reviews', reviewRoutes);
    this.app.use('/api/v1/search', searchRoutes);
    this.app.use('/api/v1/payments', paymentRoutes);
    this.app.use('/api/v1/promos', promoRoutes);
    this.app.use('/api/v1/analytics', analyticsRoutes);
    this.app.use('/api/v1/support', supportRoutes);
    this.app.use('/api/v1/upload', uploadRoutes);
    this.app.use('/api/v1/wallets', walletRoutes);
    this.app.use('/api/v1/admin', adminRoutes);
    this.app.use('/api/v1/location', locationRoutes);
    this.app.use('/api/v1/categories', categoryRoutes);
    this.app.use('/api/v1/food-items', foodItemRoutes);
    this.app.use('/api/v1/cookies', cookieRoutes);
    this.app.use('/api/v1/cart', cartRoutes);
    this.app.use('/api/v1/onboarding', onboardingRoutes);
    this.app.use('/api/v1/documents', documentRoutes);
    this.app.use('/api/v1/staff', staffRoutes);
    this.app.use('/api/v1/notifications', notificationRoutes);

    // Documentation Routes
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    
    this.app.get('/redoc', (req: Request, res: Response) => {
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

    this.app.get('/swagger.json', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    this.app.get('/', (req: Request, res: Response) => {
      res.json({ message: 'Welcome to Go-eat API' });
    });
  }

  private sockets(): void {
    handleSocketEvents(this.io);
  }

  private handleErrors(): void {
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        status: 'error',
        message: 'Resource not found'
      });
    });

    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      logger.error(err.stack || err.message);

      // Handle MongoDB 11000 Duplicate Key Errors gracefully
      if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        const value = err.keyValue ? err.keyValue[field] : '';
        const fieldLabel = field === 'phoneNumber' ? 'phone number' : field === 'email' ? 'email address' : field;
        return res.status(400).json({
          status: 'fail',
          message: `An account with this ${fieldLabel} (${value}) already exists. Please use a different ${fieldLabel}.`
        });
      }

      // Handle Mongoose Validation Error
      if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors || {}).map((el: any) => el.message);
        return res.status(400).json({
          status: 'fail',
          message: `Invalid input: ${errors.join('. ')}`
        });
      }

      const statusCode = err.statusCode || 500;
      const status = err.status || 'error';
      res.status(statusCode).json({
        status,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { error: err.message, stack: err.stack })
      });
    });
  }

  public listen(port: string | number): void {
    this.server.listen(port, () => {
      logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${port}`);
      startKeepAlivePing();
    });
  }
}

export default new App();
