import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import express from 'express';
import { loadConfig } from './config/env.js';
import { createStore } from './db/index.js';
import { createApp } from './app.js';
import { bootstrap } from './services/bootstrap.js';

const { config, problems } = loadConfig();
if (problems.length) { console.error('Refusing to start:\n - ' + problems.join('\n - ')); process.exit(1); }
if (config.dbDriver === 'memory') console.warn('[db] MONGODB_URI is not set: using the in-memory store. All data is lost when the server stops.');

const store = await createStore(config);
await bootstrap(store);
const { app, services } = createApp({ express, store, config });

// Scheduled posts are also published lazily on public reads, so this timer is a convenience, not a dependency.
const timer = setInterval(() => services.articles.publishDue().catch((e) => console.error('[scheduler]', e)), 60_000);
timer.unref();

const server = app.listen(config.port, () => console.log(`NewsPilot API listening on :${config.port} (${store.driver} store)`));
const stop = async () => { clearInterval(timer); server.close(); await store.close(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
