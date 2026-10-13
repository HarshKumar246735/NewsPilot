import { sha1 } from '../lib/crypto.js';

// Signed direct uploads: the browser uploads straight to Cloudinary with a signature minted here,
// so the API secret never reaches the client and the API never has to proxy file bytes.
export function signUpload(config, { now = Date.now(), folder } = {}) {
  const c = config.cloudinary;
  const params = { allowed_formats: 'jpg,jpeg,png,webp,gif,avif', folder: folder || c.folder, timestamp: Math.floor(now / 1000) };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return { cloudName: c.cloudName, apiKey: c.apiKey, signature: sha1(toSign + c.apiSecret), params, uploadUrl: `https://api.cloudinary.com/v1_1/${c.cloudName}/image/upload` };
}

export const isCloudinaryUrl = (config, url) => {
  try { const u = new URL(url); return u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && u.pathname.startsWith(`/${config.cloudinary.cloudName}/`); } catch { return false; }
};
