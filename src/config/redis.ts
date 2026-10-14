import { Redis as UpstashRedis } from '@upstash/redis';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

export interface IRedisClientWrapper {
  isOpen: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: any, options?: { EX?: number; ex?: number }): Promise<any>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number | boolean>;
  connect(): Promise<void>;
  disconnect?(): Promise<void>;
  on?(event: string, listener: (...args: any[]) => void): this;
}

const restUrl = process.env.UPSTASH_REDIS_REST_URL;
const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// 1. Upstash REST Client Implementation (HTTPS Port 443 — Firewall-Proof for cPanel)
class UpstashRedisWrapper implements IRedisClientWrapper {
  private client: UpstashRedis;
  public isOpen: boolean = false;

  constructor(url: string, token: string) {
    this.client = new UpstashRedis({ url, token });
  }

  async connect(): Promise<void> {
    try {
      const pong = await this.client.ping();
      if (pong === 'PONG' || pong) {
        this.isOpen = true;
        logger.info('⚡ Upstash Redis (REST over HTTPS) Connected');
      } else {
        this.isOpen = false;
        logger.warn('⚠️ Upstash Redis ping returned unexpected response:', pong);
      }
    } catch (err: any) {
      this.isOpen = false;
      logger.error('❌ Upstash Redis (REST) Connection Error:', err?.message || err);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const val = await this.client.get(key);
      if (val === null || val === undefined) return null;
      if (typeof val === 'string') return val;
      return String(val);
    } catch (err: any) {
      logger.warn(`⚠️ Upstash Redis get("${key}") error:`, err?.message || err);
      return null;
    }
  }

  async set(key: string, value: any, options?: { EX?: number; ex?: number }): Promise<any> {
    try {
      const ttl = options?.EX ?? options?.ex;
      const strVal = typeof value === 'string' ? value : String(value);
      if (ttl && ttl > 0) {
        return await this.client.set(key, strVal, { ex: ttl });
      }
      return await this.client.set(key, strVal);
    } catch (err: any) {
      logger.warn(`⚠️ Upstash Redis set("${key}") error:`, err?.message || err);
      return null;
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (err: any) {
      logger.warn(`⚠️ Upstash Redis del("${key}") error:`, err?.message || err);
      return 0;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (err: any) {
      logger.warn(`⚠️ Upstash Redis incr("${key}") error:`, err?.message || err);
      return 1;
    }
  }

  async expire(key: string, seconds: number): Promise<number | boolean> {
    try {
      return await this.client.expire(key, seconds);
    } catch (err: any) {
      logger.warn(`⚠️ Upstash Redis expire("${key}") error:`, err?.message || err);
      return 0;
    }
  }

  on(event: string, listener: (...args: any[]) => void): this {
    return this;
  }
}

// 2. Standard Node Redis Client Implementation (TCP Port 6379 Fallback)
class NodeRedisWrapper implements IRedisClientWrapper {
  private rawClient: any;
  public isOpen: boolean = false;

  constructor(url: string) {
    this.rawClient = createClient({
      url,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 5) {
            logger.warn('⚠️ TCP Redis connection retries exceeded. Falling back to local cache.');
            return new Error('TCP Redis connection retry limit reached');
          }
          return Math.min(retries * 500, 3000);
        },
        connectTimeout: 5000,
      },
    });

    this.rawClient.on('error', (err: any) => {
      this.isOpen = false;
      logger.error('❌ Redis Client Error:', err?.message || err);
    });

    this.rawClient.on('connect', () => {
      this.isOpen = true;
      logger.info('⚡ Redis Client Connected');
    });

    this.rawClient.on('ready', () => {
      this.isOpen = true;
    });

    this.rawClient.on('end', () => {
      this.isOpen = false;
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.rawClient.isOpen) {
        await this.rawClient.connect();
      }
      this.isOpen = Boolean(this.rawClient.isOpen);
    } catch (err: any) {
      this.isOpen = false;
      logger.warn('⚠️ Could not connect to TCP Redis, continuing with fallback:', err?.message || err);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isOpen) return null;
    return await this.rawClient.get(key);
  }

  async set(key: string, value: any, options?: { EX?: number; ex?: number }): Promise<any> {
    if (!this.isOpen) return null;
    const ttl = options?.EX ?? options?.ex;
    const strVal = typeof value === 'string' ? value : String(value);
    if (ttl && ttl > 0) {
      return await this.rawClient.set(key, strVal, { EX: ttl });
    }
    return await this.rawClient.set(key, strVal);
  }

  async del(key: string): Promise<number> {
    if (!this.isOpen) return 0;
    return await this.rawClient.del(key);
  }

  async incr(key: string): Promise<number> {
    if (!this.isOpen) return 1;
    return await this.rawClient.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number | boolean> {
    if (!this.isOpen) return 0;
    return await this.rawClient.expire(key, seconds);
  }

  on(event: string, listener: (...args: any[]) => void): this {
    this.rawClient.on(event, listener);
    return this;
  }
}

// 3. Export Active Client
let redisClient: IRedisClientWrapper;

if (restUrl && restToken) {
  logger.info('⚡ Initializing Upstash Redis via HTTPS REST (Port 443)');
  redisClient = new UpstashRedisWrapper(restUrl, restToken);
} else {
  redisClient = new NodeRedisWrapper(redisUrl);
}

export const connectRedis = async (): Promise<void> => {
  await redisClient.connect();
};

export default redisClient;
