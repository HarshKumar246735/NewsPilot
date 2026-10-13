import { validate } from '../lib/validate.js';

export const DEFAULT_SETTINGS = {
  name: 'NewsPilot', tagline: 'Navigate the News. Know the World.', url: '',
  description: 'Original news, explainers and practical guides for readers in India and around the world.',
  defaultSeoTitle: '', defaultMetaDescription: '', defaultImage: '', logoUrl: '', faviconUrl: '',
  publisher: { name: 'NewsPilot' }, contact: { email: '', phone: '', address: '' },
  social: { x: '', facebook: '', instagram: '', youtube: '', linkedin: '' },
  searchConsoleVerification: '', analytics: { ga4Id: '' },
  ads: { enabled: false, adsenseClient: '', adsTxt: '' },
  newsletter: { enabled: true, doubleOptIn: false }, comments: { enabled: false },
  homepage: { heroId: null, secondaryIds: [], pickIds: [], trendingIds: [], sections: [] },
};

const str = (max = 300) => ({ type: 'string', max });
const url = { type: 'string', max: 500, pattern: /^(https?:\/\/.+)?$/, patternMessage: 'Enter a full http(s) URL' };
export const SETTINGS_RULES = {
  name: { type: 'string', min: 1, max: 80 }, tagline: str(160), url: { type: 'string', max: 300, pattern: /^(https:\/\/[^\s/]+)?$/, patternMessage: 'Use your https origin, e.g. https://www.example.com' },
  description: str(400), defaultSeoTitle: str(120), defaultMetaDescription: str(320), defaultImage: url, logoUrl: url, faviconUrl: url,
  publisher: { type: 'object', shape: { name: str(120) } },
  contact: { type: 'object', shape: { email: { type: 'string', max: 200, pattern: /^([^\s@]+@[^\s@]+\.[^\s@]{2,})?$/, patternMessage: 'Enter a valid email' }, phone: str(40), address: str(300) } },
  social: { type: 'object', shape: { x: url, facebook: url, instagram: url, youtube: url, linkedin: url } },
  searchConsoleVerification: { type: 'string', max: 200, pattern: /^[\w-]*$/, patternMessage: 'Paste only the verification token' },
  analytics: { type: 'object', shape: { ga4Id: { type: 'string', max: 30, pattern: /^(G-[A-Z0-9]+)?$/, patternMessage: 'Looks like G-XXXXXXXXXX' } } },
  ads: { type: 'object', shape: { enabled: { type: 'boolean' }, adsenseClient: { type: 'string', max: 40, pattern: /^(ca-pub-\d+)?$/, patternMessage: 'Looks like ca-pub-1234567890' }, adsTxt: { type: 'string', max: 5000 } } },
  newsletter: { type: 'object', shape: { enabled: { type: 'boolean' }, doubleOptIn: { type: 'boolean' } } },
  comments: { type: 'object', shape: { enabled: { type: 'boolean' } } },
  homepage: { type: 'object', shape: { heroId: { type: 'string', max: 60, nullable: true }, secondaryIds: { type: 'array', max: 3, items: { type: 'string', max: 60 } }, pickIds: { type: 'array', max: 8, items: { type: 'string', max: 60 } }, trendingIds: { type: 'array', max: 10, items: { type: 'string', max: 60 } }, sections: { type: 'array', max: 12, items: { type: 'object', shape: { categorySlug: { type: 'string', max: 100 }, enabled: { type: 'boolean' } } } } } },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b || {})) o[k] = isObj(v) && isObj(a?.[k]) ? merge(a[k], v) : v; return o; };

export function createSettingsService({ store, config }) {
  const col = store.col('settings');
  return {
    async get() {
      const row = await col.findOne({ id: 'site' });
      const s = merge(DEFAULT_SETTINGS, row || {});
      s.url = s.url || config.siteUrl;
      return s;
    },
    async update(patch) {
      const clean = validate(patch, SETTINGS_RULES, { partial: true });
      const row = await col.findOne({ id: 'site' });
      const next = merge(row || {}, clean);
      if (row) await col.update('site', next); else await col.insert({ ...next, id: 'site' });
      return this.get();
    },
  };
}
