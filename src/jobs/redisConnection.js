import Redis from 'ioredis';
import { REDIS_URL } from '../config/env.js';

if (!REDIS_URL) {
  console.error('CRITICAL ERROR: REDIS_URL is not defined in the environment.');
  process.exit(1);
}

// Strip any wrapping quotes from the REDIS_URL if present
const cleanRedisUrl = REDIS_URL.replace(/^"|"$/g, '');

console.log('Connecting to Redis...');
const connection = new Redis(cleanRedisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ Queue/Worker
  tls: {},                    // Required for Upstash TLS
});

connection.on('connect', () => {
  console.log('Redis connected successfully.');
});

connection.on('error', (error) => {
  console.error('CRITICAL ERROR: Failed to connect to Redis.', error.message);
  process.exit(1);
});

export default connection;
