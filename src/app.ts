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
import activityRoutes from './routes/activity.routes';
import voiceRoutes from './routes/voice.routes';
import zegoRoutes from './routes/zego.routes';
import riderVerificationRoutes from './routes/rider-verification.routes';
import partnerApplicationRoutes from './routes/partnerApplication.routes';
import incidentRoutes from './routes/incident.routes';
import customMealRequestRoutes from './routes/customMealRequest.routes';
import activityService from './services/activity.service';
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

    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
      : [
          'http://localhost:3000',
          'http://localhost:8081',
          'http://localhost:19006',
          'http://localhost:5173',
          'https://goeat.ng',
          'https://admin.goeat.ng',
          'https://vendor.goeat.ng',
        ];

    const isOriginAllowed = (origin: string | undefined): boolean => {
      // Allow all origins during development and testing phase.
      // In strict production mode, toggle ENFORCE_CORS=true in .env to enforce domain whitelisting.
      if (process.env.ENFORCE_CORS !== 'true') {
        return true;
      }
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return true;
      if (allowedOrigins.includes(origin)) {
        return true;
      }
      return false;
    };

    this.io = new Server(this.server, {
      cors: {
        origin: (origin, callback) => {
          if (isOriginAllowed(origin)) {
            return callback(null, true);
          }
          return callback(new Error('Blocked by CORS policy'), false);
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true,
      },
    });

    this.config(isOriginAllowed);
    this.database();
    this.routes();
    this.sockets();
    this.handleErrors();
    activityService.startInactivityCron();
  }

  private database(): void {
    connectDB();
  }

  private config(isOriginAllowed: (origin: string | undefined) => boolean): void {
    // Trust reverse proxy headers (e.g. Render, Cloudflare, load balancers)
    this.app.set('trust proxy', 1);

    // Capture rawBody for cryptographic webhook signatures (Stripe, Paystack)
    this.app.use(
      express.json({
        limit: '10mb',
        verify: (req: any, _res, buf) => {
          req.rawBody = buf;
        },
      })
    );
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(mongoSanitizeMiddleware);

    this.app.use(
      cors({
        origin: (origin, callback) => {
          // If CORS enforcement is not strictly enabled, allow any calling origin
          if (process.env.ENFORCE_CORS !== 'true' || !origin || isOriginAllowed(origin)) {
            return callback(null, origin || true);
          }
          return callback(new Error('Blocked by CORS policy'));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'Accept',
          'Origin',
          'x-country',
          'x-country-code',
          'x-region',
          'x-region-code',
          'x-latitude',
          'x-longitude',
          'x-platform',
          'stripe-signature',
          'x-paystack-signature',
          'verif-hash',
        ],
      })
    );

    this.app.use(helmet());
    this.app.use(morgan('dev'));

    // Secure static uploads serving against Stored XSS
    this.app.use(
      '/uploads',
      (_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        next();
      },
      express.static(uploadDir)
    );
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
    this.app.use('/api/v1/activity', activityRoutes);
    this.app.use('/api/v1/voice', voiceRoutes);
    this.app.use('/api/v1/zego', zegoRoutes);
    this.app.use('/api/v1/riders', riderVerificationRoutes);
    this.app.use('/api/v1/partners', partnerApplicationRoutes);
    this.app.use('/api/v1/incidents', incidentRoutes);
    this.app.use('/api/v1/custom-requests', customMealRequestRoutes);

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
        const fieldLabels: Record<string, string> = {
          'emergencyContact.phone': 'emergency contact phone number',
          'emergencyContact.name': 'emergency contact name',
          'residentialAddress': 'residential address',
          'phoneNumber': 'phone number',
          'dob': 'date of birth',
          'fullName': 'full name',
          'emailAddress': 'email address',
          'documents.guarantorInfo': 'guarantor information',
          'ninVerification.nin': 'NIN number',
          'vehicle.registrationNumber': 'vehicle registration plate',
        };

        const errorItems = Object.values(err.errors || {});
        const missingFields: string[] = [];
        const otherErrors: string[] = [];

        for (const item of errorItems as any[]) {
          const path = item.path || '';
          const label = fieldLabels[path] || path.replace(/([A-Z])/g, ' $1').toLowerCase();

          if (item.kind === 'required' || (item.message && item.message.includes('is required'))) {
            missingFields.push(label);
          } else if (item.name === 'CastError' || (item.message && item.message.includes('Cast to'))) {
            otherErrors.push(`Invalid format for ${label}`);
          } else if (item.message) {
            const cleaned = item.message.replace(/Path `([^`]+)` is required\.?/g, (_: string, p: string) => {
              return `Please provide ${fieldLabels[p] || p}`;
            });
            otherErrors.push(cleaned);
          }
        }

        let cleanMessage = '';
        if (missingFields.length > 0) {
          cleanMessage = `Please provide the following required details: ${missingFields.join(', ')}.`;
        }
        if (otherErrors.length > 0) {
          cleanMessage = cleanMessage ? `${cleanMessage} ${otherErrors.join('. ')}` : otherErrors.join('. ');
        }
        if (!cleanMessage) {
          cleanMessage = 'Please complete all required fields with valid information.';
        }

        return res.status(400).json({
          status: 'fail',
          message: cleanMessage,
        });
      }

      // Handle JWT Token Errors
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          status: 'fail',
          message: 'Invalid token. Please log in again.'
        });
      }
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'fail',
          message: 'Your session has expired! Please log in again.'
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
