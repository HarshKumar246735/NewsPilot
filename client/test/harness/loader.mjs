// Node module hooks used ONLY by the test suite: compile .jsx, ignore .css, and stand in for the two
// packages that are not needed to test our own components (react-router-dom, lucide-react).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIMS = {
  'react-router-dom': 'shims/router.mjs', 'react-router-dom/server': 'shims/router.mjs', 'lucide-react': 'shims/lucide.mjs',
};
const GLOBAL_NM = process.env.NP_GLOBAL_NODE_MODULES || '/home/claude/.npm-global/lib/node_modules';
let ts;
async function getTs() {
  if (ts) return ts;
  try { ts = (await import('typescript')).default; } catch { ts = (await import(pathToFileURL(path.join(GLOBAL_NM, 'typescript/lib/typescript.js')).href)).default; }
  return ts;
}

export async function resolve(specifier, context, next) {
  if (SHIMS[specifier]) return { url: pathToFileURL(path.join(here, SHIMS[specifier])).href, shortCircuit: true };
  if (specifier.endsWith('.css')) return { url: `data:text/javascript,export default {}`, shortCircuit: true };
  try { return await next(specifier, context); } catch (e) {
    if (e.code !== 'ERR_MODULE_NOT_FOUND' || !/^(react|react-dom)(\/|$)/.test(specifier)) throw e;
    const url = pathToFileURL(createRequire(path.join(GLOBAL_NM, 'x.js')).resolve(specifier)).href; // fall back to a global React
    return { url, shortCircuit: true };
  }
}

export async function load(url, context, next) {
  if (url.endsWith('.jsx')) {
    const t = await getTs();
    const source = fs.readFileSync(fileURLToPath(url), 'utf8');
    const out = t.transpileModule(source, { compilerOptions: { jsx: t.JsxEmit.ReactJSX, module: t.ModuleKind.ESNext, target: t.ScriptTarget.ES2022 }, fileName: url, reportDiagnostics: true });
    const errs = (out.diagnostics || []).filter((d) => d.category === t.DiagnosticCategory.Error);
    if (errs.length) throw new Error(`${url}: ${errs.map((d) => t.flattenDiagnosticMessageText(d.messageText, '\n')).join('; ')}`);
    return { format: 'module', source: out.outputText, shortCircuit: true };
  }
  return next(url, context);
}
