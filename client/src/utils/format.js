// Deterministic date formatting in India Standard Time. Intl.DateTimeFormat is deliberately NOT used: Node and each
// browser ship different ICU data, so Intl output can differ between the server render and the browser, which breaks hydration.
const IST_OFFSET_MS = 5.5 * 3600e3;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ist = (iso) => new Date(new Date(iso).getTime() + IST_OFFSET_MS); // read with the getUTC* methods

export const formatDate = (iso) => { const d = ist(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const formatLongDate = (iso) => { const d = ist(iso); return `${DAYS_LONG[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export function formatDateTime(iso) {
  const d = ist(iso); const h = d.getUTCHours();
  return `${formatDate(iso)}, ${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'} IST`;
}

export function timeAgo(iso, now) {
  const diff = Math.max(0, new Date(now) - new Date(iso));
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day > 1 ? 's' : ''} ago`;
  return formatDate(iso);
}
