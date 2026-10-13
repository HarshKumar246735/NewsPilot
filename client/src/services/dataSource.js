import { createApiSource } from './apiSource.js';

// `__ALLOW_DEMO__` is replaced at build time (see vite.config.js). In a plain production build
// the demo branch is dead code and the demo files are not shipped.
export async function createDataSource(config) {
  if (config.demo) {
    if (typeof __ALLOW_DEMO__ !== 'undefined' && __ALLOW_DEMO__) {
      const { createDemoSource } = await import('../demo/demoSource.js');
      return createDemoSource(config);
    }
    throw new Error('Demonstration content is not included in this build.');
  }
  return createApiSource(config);
}
