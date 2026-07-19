import logger from './logger';

const PING_INTERVAL = 3 * 60 * 1000; // 3 minutes

export function startKeepAlivePing() {
  const serverUrl = process.env.RENDER_EXTERNAL_URL || 'https://go-eat-server.onrender.com';
  const healthUrl = `${serverUrl}/api/health`;

  logger.info(`⏰ Initializing self-ping keep-alive service every 3 minutes to: ${healthUrl}`);

  setInterval(async () => {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        logger.info(`⚡ Keep-alive ping successful to ${healthUrl} (Status: ${res.status})`);
      } else {
        logger.warn(`⚠️ Keep-alive ping warning: ${res.status} ${res.statusText}`);
      }
    } catch (err: any) {
      logger.error(`❌ Keep-alive ping failed: ${err.message}`);
    }
  }, PING_INTERVAL);
}
