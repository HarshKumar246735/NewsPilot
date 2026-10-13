import { hashPassword } from '../lib/crypto.js';
import { slugify } from '../seo/index.js';
import { DEFAULT_CATEGORIES } from '../config/defaultCategories.js';

// Idempotent first-run setup: default sections, and an admin account taken from environment variables
// (there are no default credentials anywhere in this project).
export async function bootstrap(store, env = process.env, log = console.log) {
  const C = store.col('categories'), U = store.col('users'), AU = store.col('authors');
  if ((await C.count({})) === 0) {
    for (const [i, [slug, name, parentSlug, primary]] of DEFAULT_CATEGORIES.entries()) await C.insert({ slug, name, parentSlug, primary: !!primary, order: i, enabled: true, description: '', createdAt: new Date().toISOString() });
    log(`[bootstrap] created ${DEFAULT_CATEGORIES.length} default sections`);
  }
  const email = (env.ADMIN_EMAIL || '').trim().toLowerCase(), password = env.ADMIN_PASSWORD || '';
  if (!email || !password) { if (!(await U.count({}))) log('[bootstrap] no users yet: set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) and restart, or run `npm run create-admin`'); return null; }
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  let user = await U.findOne({ email });
  if (!user) {
    const name = env.ADMIN_NAME || 'Editor';
    user = await U.insert({ email, name, role: 'admin', passwordHash: await hashPassword(password), tokenVersion: 0, active: true, createdAt: new Date().toISOString() });
    if (!(await AU.findOne({ userId: user.id }))) {
      let slug = slugify(name) || 'editor', n = 2;
      while (await AU.findOne({ slug })) slug = `${slugify(name) || 'editor'}-${n++}`;
      await AU.insert({ slug, name, bio: '', userId: user.id, createdAt: new Date().toISOString() });
    }
    log(`[bootstrap] created admin ${email}`);
  }
  return user;
}
