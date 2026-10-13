// Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='at least 12 chars' MONGODB_URI=... npm run create-admin
import { loadConfig } from '../src/config/env.js';
import { createStore } from '../src/db/index.js';
import { bootstrap } from '../src/services/bootstrap.js';
import { hashPassword } from '../src/lib/crypto.js';

const { config } = loadConfig();
if (config.dbDriver !== 'mongo') { console.error('Set MONGODB_URI first, otherwise the account would only exist in this process\'s memory.'); process.exit(1); }
const store = await createStore(config);
const user = await bootstrap(store);
if (user && process.env.RESET_PASSWORD === 'true') {
  await store.col('users').update(user.id, { passwordHash: await hashPassword(process.env.ADMIN_PASSWORD), tokenVersion: (user.tokenVersion || 0) + 1 });
  console.log('Password reset and existing sessions signed out.');
}
await store.close();
