import { randomToken } from '../lib/crypto.js';

export function loadConfig(env = process.env) {
  const prod = env.NODE_ENV === 'production';
  const strip = (s = '') => s.trim().replace(/\/$/, '');
  const config = {
    prod,
    port: Number(env.PORT) || 4000,
    dbDriver: env.MONGODB_URI ? 'mongo' : 'memory',
    mongoUri: env.MONGODB_URI || '',
    jwtSecret: env.JWT_SECRET || (prod ? '' : randomToken(32)),
    siteUrl: strip(env.SITE_URL),
    publicApiUrl: strip(env.API_PUBLIC_URL),
    clientOrigins: (env.CLIENT_ORIGINS || env.SITE_URL || '').split(',').map(strip).filter(Boolean),
    cloudinary: { cloudName: env.CLOUDINARY_CLOUD_NAME || '', apiKey: env.CLOUDINARY_API_KEY || '', apiSecret: env.CLOUDINARY_API_SECRET || '', folder: env.CLOUDINARY_FOLDER || 'newspilot' },
    mail: { resendKey: env.RESEND_API_KEY || '', from: env.MAIL_FROM || '' },
    allowLocalUploads: env.ALLOW_LOCAL_UPLOADS === 'true' || (!prod && env.ALLOW_LOCAL_UPLOADS !== 'false'),
    uploadDir: env.UPLOAD_DIR || 'uploads',
    maxImageBytes: 8 * 1024 * 1024,
  };
  const problems = [];
  if (prod) {
    if (config.jwtSecret.length < 32) problems.push('JWT_SECRET must be set to a random string of at least 32 characters');
    if (!config.mongoUri) problems.push('MONGODB_URI is required in production (the in-memory store loses all data on restart)');
    if (!/^https:\/\//.test(config.siteUrl)) problems.push('SITE_URL must be your https production domain');
    if (!config.clientOrigins.length) problems.push('CLIENT_ORIGINS (or SITE_URL) must list the allowed frontend origins');
    if (config.clientOrigins.some((o) => /localhost|127\.0\.0\.1/.test(o))) problems.push('CLIENT_ORIGINS must not contain localhost in production');
  }
  config.cloudinary.enabled = !!(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);
  config.mail.enabled = !!(config.mail.resendKey && config.mail.from);
  return { config, problems };
}
