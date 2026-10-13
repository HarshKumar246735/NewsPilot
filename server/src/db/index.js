import { createMemoryStore } from './memoryStore.js';

export async function createStore(config) {
  if (config.dbDriver === 'mongo') {
    const { createMongoStore } = await import('./mongoStore.js');
    return createMongoStore({ uri: config.mongoUri });
  }
  return createMemoryStore();
}
