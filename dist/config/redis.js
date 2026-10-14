"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = void 0;
const redis_1 = require("@upstash/redis");
const redis_2 = require("redis");
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = __importDefault(require("../utils/logger"));
dotenv_1.default.config();
const restUrl = process.env.UPSTASH_REDIS_REST_URL;
const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
// 1. Upstash REST Client Implementation (HTTPS Port 443 — Firewall-Proof for cPanel)
class UpstashRedisWrapper {
    constructor(url, token) {
        this.isOpen = false;
        this.client = new redis_1.Redis({ url, token });
    }
    async connect() {
        try {
            const pong = await this.client.ping();
            if (pong === 'PONG' || pong) {
                this.isOpen = true;
                logger_1.default.info('⚡ Upstash Redis (REST over HTTPS) Connected');
            }
            else {
                this.isOpen = false;
                logger_1.default.warn('⚠️ Upstash Redis ping returned unexpected response:', pong);
            }
        }
        catch (err) {
            this.isOpen = false;
            logger_1.default.error('❌ Upstash Redis (REST) Connection Error:', err?.message || err);
        }
    }
    async get(key) {
        try {
            const val = await this.client.get(key);
            if (val === null || val === undefined)
                return null;
            if (typeof val === 'string')
                return val;
            return String(val);
        }
        catch (err) {
            logger_1.default.warn(`⚠️ Upstash Redis get("${key}") error:`, err?.message || err);
            return null;
        }
    }
    async set(key, value, options) {
        try {
            const ttl = options?.EX ?? options?.ex;
            const strVal = typeof value === 'string' ? value : String(value);
            if (ttl && ttl > 0) {
                return await this.client.set(key, strVal, { ex: ttl });
            }
            return await this.client.set(key, strVal);
        }
        catch (err) {
            logger_1.default.warn(`⚠️ Upstash Redis set("${key}") error:`, err?.message || err);
            return null;
        }
    }
    async del(key) {
        try {
            return await this.client.del(key);
        }
        catch (err) {
            logger_1.default.warn(`⚠️ Upstash Redis del("${key}") error:`, err?.message || err);
            return 0;
        }
    }
    async incr(key) {
        try {
            return await this.client.incr(key);
        }
        catch (err) {
            logger_1.default.warn(`⚠️ Upstash Redis incr("${key}") error:`, err?.message || err);
            return 1;
        }
    }
    async expire(key, seconds) {
        try {
            return await this.client.expire(key, seconds);
        }
        catch (err) {
            logger_1.default.warn(`⚠️ Upstash Redis expire("${key}") error:`, err?.message || err);
            return 0;
        }
    }
    on(event, listener) {
        return this;
    }
}
// 2. Standard Node Redis Client Implementation (TCP Port 6379 Fallback)
class NodeRedisWrapper {
    constructor(url) {
        this.isOpen = false;
        this.rawClient = (0, redis_2.createClient)({
            url,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 5) {
                        logger_1.default.warn('⚠️ TCP Redis connection retries exceeded. Falling back to local cache.');
                        return new Error('TCP Redis connection retry limit reached');
                    }
                    return Math.min(retries * 500, 3000);
                },
                connectTimeout: 5000,
            },
        });
        this.rawClient.on('error', (err) => {
            this.isOpen = false;
            logger_1.default.error('❌ Redis Client Error:', err?.message || err);
        });
        this.rawClient.on('connect', () => {
            this.isOpen = true;
            logger_1.default.info('⚡ Redis Client Connected');
        });
        this.rawClient.on('ready', () => {
            this.isOpen = true;
        });
        this.rawClient.on('end', () => {
            this.isOpen = false;
        });
    }
    async connect() {
        try {
            if (!this.rawClient.isOpen) {
                await this.rawClient.connect();
            }
            this.isOpen = Boolean(this.rawClient.isOpen);
        }
        catch (err) {
            this.isOpen = false;
            logger_1.default.warn('⚠️ Could not connect to TCP Redis, continuing with fallback:', err?.message || err);
        }
    }
    async get(key) {
        if (!this.isOpen)
            return null;
        return await this.rawClient.get(key);
    }
    async set(key, value, options) {
        if (!this.isOpen)
            return null;
        const ttl = options?.EX ?? options?.ex;
        const strVal = typeof value === 'string' ? value : String(value);
        if (ttl && ttl > 0) {
            return await this.rawClient.set(key, strVal, { EX: ttl });
        }
        return await this.rawClient.set(key, strVal);
    }
    async del(key) {
        if (!this.isOpen)
            return 0;
        return await this.rawClient.del(key);
    }
    async incr(key) {
        if (!this.isOpen)
            return 1;
        return await this.rawClient.incr(key);
    }
    async expire(key, seconds) {
        if (!this.isOpen)
            return 0;
        return await this.rawClient.expire(key, seconds);
    }
    on(event, listener) {
        this.rawClient.on(event, listener);
        return this;
    }
}
// 3. Export Active Client
let redisClient;
if (restUrl && restToken) {
    logger_1.default.info('⚡ Initializing Upstash Redis via HTTPS REST (Port 443)');
    redisClient = new UpstashRedisWrapper(restUrl, restToken);
}
else {
    redisClient = new NodeRedisWrapper(redisUrl);
}
const connectRedis = async () => {
    await redisClient.connect();
};
exports.connectRedis = connectRedis;
exports.default = redisClient;
