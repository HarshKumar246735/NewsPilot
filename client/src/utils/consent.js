import { useEffect, useState } from 'react';

const KEY = 'np-consent-v1';
const listeners = new Set();
export const getConsent = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export function setConsent(v) { try { localStorage.setItem(KEY, v); } catch { /* private mode: choice lasts for this page view only */ } listeners.forEach((l) => l(v)); }

// 'granted' | 'denied' | null (not chosen yet). Always null during server rendering, so server and client markup match.
export function useConsent() {
  const [v, setV] = useState(null);
  useEffect(() => { setV(getConsent()); listeners.add(setV); return () => listeners.delete(setV); }, []);
  return v;
}
