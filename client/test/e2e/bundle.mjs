// A tiny CommonJS bundler for the e2e harness: transpiles the real client sources with TypeScript and runs them
// in Chromium with the real React 19 packages. Not part of the production build (Vite does that).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const GNM = process.env.NP_GLOBAL_NODE_MODULES || '/home/claude/.npm-global/lib/node_modules';
const ts = createRequire(path.join(GNM, 'x.js'))('typescript');
const SHIM = { 'react-router-dom': 'router.browser.mjs', 'lucide-react': 'lucide.mjs' };

export function bundle(entry, { shimDir }) {
  const mods = new Map(); const css = []; const order = [];
  const resolveFile = (spec, from) => {
    if (SHIM[spec]) return path.join(shimDir, SHIM[spec]);
    if (spec.startsWith('.') || path.isAbsolute(spec)) {
      const base = path.resolve(path.dirname(from), spec);
      for (const c of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, path.join(base, 'index.js')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
      throw new Error(`Cannot resolve ${spec} from ${from}`);
    }
    const req = createRequire(from.includes('node_modules') || !from.startsWith('/home') ? from : path.join(GNM, 'x.js'));
    try { return req.resolve(spec); } catch { return createRequire(path.join(GNM, 'x.js')).resolve(spec); }
  };
  function add(file) {
    if (mods.has(file)) return;
    mods.set(file, null);
    let code = fs.readFileSync(file, 'utf8');
    const deps = {};
    if (!file.includes('node_modules')) {
      code = ts.transpileModule(code, { fileName: file.replace(/\.mjs$/, '.js'), compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    }
    for (const m of code.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) {
      const spec = m[1];
      if (/\.css$/.test(spec)) { const f = path.resolve(path.dirname(file), spec); if (!css.includes(f)) css.push(f); deps[spec] = '__empty'; continue; }
      if (/^node:/.test(spec)) { deps[spec] = '__empty'; continue; }
      const f = resolveFile(spec, file); deps[spec] = f; add(f);
    }
    mods.set(file, { code, deps }); order.push(file);
  }
  add(entry);
  const body = [...mods.entries()].map(([f, { code, deps }]) => `${JSON.stringify(f)}: [function(module, exports, require){\n${code}\n}, ${JSON.stringify(deps)}]`).join(',\n');
  const js = `(function(){var process={env:{NODE_ENV:'development'}};window.process=process;var __ALLOW_DEMO__=false;
var defs={${body}};var cache={};
function load(id){ if(id==='__empty') return {}; if(cache[id]) return cache[id].exports; var d=defs[id]; if(!d) throw new Error('missing module '+id); var m=cache[id]={exports:{}}; d[0].call(m.exports,m,m.exports,function(s){return load(d[1][s]);}); return m.exports; }
load(${JSON.stringify(entry)}); })();`;
  // Inline @import'ed files the way Vite does (global.css imports variables.css).
  const inline = (f) => fs.readFileSync(f, 'utf8').replace(/@import\s+['"]([^'"]+)['"];?/g, (_m, rel) => inline(path.resolve(path.dirname(f), rel)));
  const cssText = css.map(inline).join('\n');
  return { js, css: cssText };
}
export { pathToFileURL };
