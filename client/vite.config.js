import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Demo images live in public/demo for local work; strip them from real production builds.
const stripDemoAssets = (mode) => ({
  name: 'np-strip-demo-assets',
  closeBundle() {
    if (mode === 'demo') return;
    fs.rmSync(path.resolve(here, 'dist/client/demo'), { recursive: true, force: true });
  },
});

export default defineConfig(({ mode, isSsrBuild, command }) => ({
  plugins: [react(), stripDemoAssets(mode)],
  // Demo content is compiled in only for `dev` and `build:demo`. Plain `build` tree-shakes it out.
  define: { __ALLOW_DEMO__: JSON.stringify(mode === 'demo' || mode === 'development') },
  build: {
    outDir: 'dist/client',
    ...(isSsrBuild ? {} : { rollupOptions: { input: path.resolve(here, 'template.html') } }),
  },
  // Production only: bundle everything into the server build so the Vercel function needs no node_modules.
  // In dev this must stay off, or Vite tries to run React's CommonJS files through its ES-module loader
  // ("module is not defined"); dev loads dependencies from node_modules with Node instead.
  ssr: command === 'build' ? { noExternal: true } : {},
  // The SEO engine lives in ../server/src/seo and is shared by relative import.
  server: { fs: { allow: ['..'] } },
}));
