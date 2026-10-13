// Vercel serverless function: server-side renders every public page, robots.txt and sitemap.xml.
// Static assets (/assets/*, favicon, images) are served by Vercel before this function is reached.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configFromEnv, respond } from '../client/ssr-handler.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let loaded;
async function load() {
  loaded ||= {
    template: fs.readFileSync(path.join(here, '../client/dist/client/template.html'), 'utf8'),
    render: (await import('../client/dist/server/entry-server.js')).render,
  };
  return loaded;
}

export default async function handler(req, res) {
  try {
    const { template, render } = await load();
    const out = await respond(req.url || '/', { template, render, config: configFromEnv() });
    for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
    res.status(out.status).send(out.body);
  } catch (err) {
    console.error(err);
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).send('Internal server error');
  }
}
