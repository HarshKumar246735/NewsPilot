import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.js';
import { useConsent } from '../utils/consent.js';
import './AdSlot.css';

let adsenseLoaded = false;
function loadAdsense(client) {
  if (adsenseLoaded || typeof document === 'undefined') return;
  adsenseLoaded = true;
  const s = document.createElement('script');
  s.async = true; s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
}

// Renders nothing unless the admin enabled this placement. Always labelled, with space reserved to avoid layout shift.
// AdSense only loads after the visitor accepts advertising cookies. Direct banners are plain, rel="sponsored" links.
export default function AdSlot({ placement, className = '' }) {
  const { shell, config } = useApp();
  const ad = shell.ads?.[placement];
  const client = shell.site.adsenseClient;
  const consent = useConsent();
  const pushed = useRef(false);
  const adsenseReady = ad?.type === 'adsense' && client && consent === 'granted' && !config.demo;

  useEffect(() => {
    if (!adsenseReady || pushed.current) return;
    pushed.current = true;
    loadAdsense(client);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked or already filled */ }
  }, [adsenseReady, client]);

  if (!ad) return null;
  if (ad.type === 'banner') {
    return (
      <aside className={`ad ad--${placement} ${className}`} aria-label="Advertisement">
        <p className="ad__label">Sponsored{ad.sponsor ? `: ${ad.sponsor}` : ''}</p>
        <a href={ad.link} target="_blank" rel="sponsored noopener noreferrer"><img src={ad.image} alt={ad.alt || ad.sponsor || 'Sponsored content'} loading="lazy" /></a>
      </aside>
    );
  }
  if (!adsenseReady) return null;
  return (
    <aside className={`ad ad--${placement} ${className}`} aria-label="Advertisement">
      <p className="ad__label">Advertisement</p>
      <ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client={client} data-ad-slot={ad.slot} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
