import app from './app';
import { connectRedis } from './config/redis';
import logger from './utils/logger';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to Redis
    await connectRedis();
    
    // Start Listening
    app.listen(PORT);
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
