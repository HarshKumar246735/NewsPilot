import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.js';
import { useConsent, setConsent } from '../utils/consent.js';
import './ConsentBanner.css';

let gaLoaded = false;
function loadGa(id) {
  if (gaLoaded || typeof document === 'undefined') return;
  gaLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
  window.gtag('js', new Date()); window.gtag('config', id, { anonymize_ip: true });
  const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`; document.head.appendChild(s);
}

// Shown only when advertising or analytics is configured. Nothing third-party loads until the visitor accepts.
// For visitors in the EEA/UK/Switzerland, Google requires a Google-certified consent platform for AdSense: see the README.
export default function ConsentBanner() {
  const { shell, config } = useApp();
  const consent = useConsent();
  const ga = shell.site.ga4Id;
  const needed = !config.demo && (shell.site.adsenseClient || ga);
  useEffect(() => { if (consent === 'granted' && ga && needed) loadGa(ga); }, [consent, ga, needed]);
  if (!needed || consent !== null) return null;
  return (
    <section className="consent" role="region" aria-label="Cookie choices">
      <p>We use cookies for analytics and to show advertising. You choose: nothing from these services loads until you accept. See our <Link to="/cookie-policy">cookie policy</Link>.</p>
      <div className="consent__actions">
        <button type="button" className="btn btn--sm" onClick={() => setConsent('denied')}>Reject</button>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setConsent('granted')}>Accept</button>
      </div>
    </section>
  );
}
