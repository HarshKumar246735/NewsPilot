import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createExpress, client } from './miniExpress.js';
import { createMemoryStore } from '../../src/db/memoryStore.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { bootstrap } from '../../src/services/bootstrap.js';

export const ADMIN = { email: 'admin@example.org', password: 'a-strong-password!' };
export async function boot({ env = {}, realClock = false } = {}) {
  const t = { now: realClock ? Date.now() : Date.parse('2026-10-11T10:00:00Z') };
  if (realClock) setInterval(() => { t.now = Date.now(); }, 250).unref();
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'np-up-'));
  const { config } = loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'x'.repeat(40), SITE_URL: 'https://news.example.org', CLIENT_ORIGINS: 'https://news.example.org', ALLOW_LOCAL_UPLOADS: 'true', UPLOAD_DIR: uploadDir, ...env });
  const store = createMemoryStore();
  await bootstrap(store, { ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, ADMIN_NAME: 'Ada Admin' }, () => {});
  const logs = [];
  const { app, services } = createApp({ express: createExpress(), store, config, clock: () => new Date(t.now), log: (...a) => logs.push(a) });
  const c = client(app);
  const login = async (email = ADMIN.email, password = ADMIN.password) => (await c.post('/auth/login', { body: { email, password } })).body?.token;
  const adminToken = await login();
  // helpers
  const mk = async (over = {}, token = adminToken) => (await c.post('/admin/articles', { token, body: { title: 'Sample story', contentHtml: '<p>' + 'A useful sentence about the topic. '.repeat(20) + '</p>', categorySlug: 'technology', authorSlug: 'ada-admin', ...over } }));
  const publish = async (id, body = {}, token = adminToken) => c.post(`/admin/articles/${id}/publish`, { token, body });
  const mkPub = async (over = {}) => { const a = (await mk(over)).body.item; const p = await publish(a.id); return { ...p.body.article, id: a.id }; };
  const mkUser = async (role, email = `${role}@example.org`) => { await c.post('/admin/users', { token: adminToken, body: { email, name: `${role} user`, role, password: 'another-strong-pass1' } }); return login(email, 'another-strong-pass1'); };
  return { c, app, store, services, config, t, adminToken, login, mk, publish, mkPub, mkUser, logs, uploadDir };
}
