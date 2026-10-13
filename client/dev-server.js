// Local server with real server-side rendering.
//   npm run dev            Vite dev server (HMR) + SSR, with demonstration content
//   npm run dev:api        same, using API_URL instead of demo content
//   npm run preview[:demo] serves the production build from dist/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { configFromEnv, respond } from './ssr-handler.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const prod = args.includes('--prod');
const port = Number(process.env.PORT || 5173);
if (args.includes('--demo')) process.env.NP_DEMO = 'true';
process.env.SITE_URL ||= `http://localhost:${port}`; // local only; production must set SITE_URL
const config = configFromEnv();

const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json' };

let vite;
let prodTemplate; let prodRender;
if (prod) {
  prodTemplate = fs.readFileSync(path.join(root, 'dist/client/template.html'), 'utf8');
  prodRender = (await import(pathToFileURL(path.join(root, 'dist/server/entry-server.js')).href)).render;
} else {
  // Vite applies `define` constants to browser code in dev but NOT to modules loaded through ssrLoadModule,
  // so the server-side copy of the demo switch must be set by hand (builds replace it at compile time).
  globalThis.__ALLOW_DEMO__ = true;
  const { createServer } = await import('vite');
  vite = await createServer({ root, appType: 'custom', server: { middlewareMode: true }, mode: 'development' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url || '/';
    const pathname = url.split('?')[0];
    if (pathname.startsWith('/uploads/') && config.apiUrl && !prod) { // dev convenience: local uploads live on the API origin
      const up = await fetch(new URL(pathname, config.apiUrl));
      res.writeHead(up.status, { 'Content-Type': up.headers.get('content-type') || 'application/octet-stream' });
      return res.end(Buffer.from(await up.arrayBuffer()));
    }
    if (prod) {
      const file = path.join(root, 'dist/client', pathname);
      if (pathname !== '/' && file.startsWith(path.join(root, 'dist/client')) && fs.existsSync(file) && fs.statSync(file).isFile() && !pathname.endsWith('template.html')) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        return fs.createReadStream(file).pipe(res);
      }
    } else {
      // Let Vite serve modules, HMR and public files; fall through to SSR for page requests.
      const passedThrough = await new Promise((resolve) => {
        res.on('close', () => resolve(false));
        vite.middlewares(req, res, () => resolve(true));
      });
      if (!passedThrough) return undefined;
    }
    const template = prod ? prodTemplate : await vite.transformIndexHtml(url, fs.readFileSync(path.join(root, 'template.html'), 'utf8'));
    const render = prod ? prodRender : (await vite.ssrLoadModule('/src/entry-server.jsx')).render;
    const out = await respond(url, { template, render, config });
    res.writeHead(out.status, out.headers);
    return res.end(out.body);
  } catch (err) {
    vite?.ssrFixStacktrace?.(err);
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    return res.end('Internal server error');
  }
});
server.listen(port, () => console.log(`NewsPilot ${prod ? 'preview' : 'dev'} server: http://localhost:${port}  (${config.demo ? 'demonstration content' : `API ${config.apiUrl || 'not configured'}`})`));
