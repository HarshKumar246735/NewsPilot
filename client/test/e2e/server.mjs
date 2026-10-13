// Starts the real API (over real HTTP) and the real SSR frontend, both in-process, for the e2e run.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const client = path.resolve(here, '../..');
globalThis.__ALLOW_DEMO__ = false;
register('../harness/loader.mjs', import.meta.url);

const readBody = (req) => new Promise((res) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => res(Buffer.concat(c).toString())); });
const listen = (srv, port) => new Promise((res) => srv.listen(port, '127.0.0.1', () => res(srv.address().port)));

export async function startServers({ apiPort = 4100, sitePort = 5100 } = {}) {
  const siteOrigin = `http://127.0.0.1:${sitePort}`, apiOrigin = `http://127.0.0.1:${apiPort}`;
  const { boot } = await import('../../../server/test/helpers/boot.js');
  const w = await boot({ realClock: true, env: { SITE_URL: siteOrigin, CLIENT_ORIGINS: siteOrigin, NODE_ENV: 'test' } });

  const api = http.createServer(async (req, res) => {
    const body = await readBody(req);
    const r = await w.app.dispatch({ method: req.method, url: req.url, headers: req.headers, body: body || undefined, ip: req.socket.remoteAddress });
    res.writeHead(r.status, r.headers); res.end(r.text);
  });
  await listen(api, apiPort);

  const { render } = await import('../../src/entry-server.jsx');
  const { respond } = await import('../../ssr-handler.js');
  const config = { demo: false, siteUrl: siteOrigin, apiUrl: apiOrigin };
  const b = bundle(path.join(client, 'src/entry-client.jsx'), { shimDir: path.join(here, '../harness/shims') });
  const tpl = fs.readFileSync(path.join(client, 'template.html'), 'utf8')
    .replace(/<link rel="(preconnect|stylesheet)"[^>]*fonts[^>]*>\n?/g, '')
    .replace('<script type="module" src="/src/entry-client.jsx"></script>', '<link rel="stylesheet" href="/__styles.css"><script src="/__bundle.js"></script>');

  const site = http.createServer(async (req, res) => {
    const p = req.url.split('?')[0];
    if (p === '/__bundle.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(b.js); }
    if (p === '/__styles.css') { res.writeHead(200, { 'Content-Type': 'text/css' }); return res.end(b.css); }
    if (p === '/favicon.svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); return res.end(fs.readFileSync(path.join(client, 'public/favicon.svg'))); }
    if (p.startsWith('/uploads/')) { const f = path.join(w.uploadDir, path.basename(p)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(fs.readFileSync(f)); } // the real API serves these with express.static
    const out = await respond(req.url, { template: tpl, render, config });
    res.writeHead(out.status, out.headers); res.end(out.body);
  });
  await listen(site, sitePort);
  return { w, siteOrigin, apiOrigin, close: () => { api.close(); site.close(); } };
}
