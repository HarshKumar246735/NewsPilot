import { createAudit } from './services/audit.js';
import { createSettingsService } from './services/settings.js';
import { createArticleService } from './services/articles.js';
import { createPublicService } from './services/public.js';
import { createNewsletter, createComments } from './services/engagement.js';
import { createMailer } from './services/mail.js';
import { createAuth } from './middleware/auth.js';
import { securityHeaders, cors, guardInput, notFoundHandler, errorHandler } from './middleware/security.js';
import { authRoutes } from './routes/auth.js';
import { publicRoutes } from './routes/public.js';
import { adminRoutes } from './routes/admin.js';

// `express` is injected so the same code runs under real Express in production and under the test harness.
export function createApp({ express, store, config, clock = () => new Date(), fetchImpl, log = console.error }) {
  const app = express();
  app.set('trust proxy', 1); // Render sits behind a proxy; this makes req.ip the real client address for rate limits
  app.disable('x-powered-by');

  const audit = createAudit({ store, clock });
  const settings = createSettingsService({ store, config });
  const articles = createArticleService({ store, settings, audit, clock });
  const pub = createPublicService({ store, settings, articles, clock });
  const mailer = createMailer({ config, fetchImpl });
  const newsletter = createNewsletter({ store, settings, mailer, config, clock });
  const comments = createComments({ store, settings, clock });
  const auth = createAuth({ store, config, clock });
  const services = { store, audit, settings, articles, pub, newsletter, comments, mailer };

  app.use(securityHeaders({ prod: config.prod }));
  app.use(cors(config.clientOrigins));
  if (config.allowLocalUploads) app.use('/uploads', express.static(config.uploadDir, { index: false, dotfiles: 'deny', maxAge: '7d' }));

  app.get('/health', async (req, res) => {
    let db = false; try { db = await store.ping(); } catch { /* reported below */ }
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', database: db ? store.driver : 'unreachable', uptimeSeconds: Math.round(process.uptime()), time: clock().toISOString() });
  });
  app.get('/', (req, res) => res.json({ name: 'NewsPilot API', docs: 'See README.md' }));

  const json = express.json({ limit: '1mb' });
  app.use((req, res, next) => (req.path === '/admin/media/local' ? next() : json(req, res, next))); // that route has its own larger limit
  app.use(guardInput);

  app.use('/auth', authRoutes({ express, store, config, clock, audit, auth }));
  app.use('/public', publicRoutes({ express, services, config, clock }));
  app.use('/admin', adminRoutes({ express, store, config, clock, services, auth }));

  app.use(notFoundHandler);
  app.use(errorHandler({ log }));
  return { app, services };
}
