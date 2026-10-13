import { useEffect, useState } from 'react';
import { Link2, Mail, Share2, Check } from 'lucide-react';
import './ShareBar.css';

// `url` must be the canonical absolute URL (from the page head), never window.location.
export default function ShareBar({ url, title }) {
  const [copied, setCopied] = useState('idle');
  const [canShare, setCanShare] = useState(false);
  useEffect(() => { setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function'); }, []);
  const u = encodeURIComponent(url), t = encodeURIComponent(title);
  const targets = [
    ['X', `https://twitter.com/intent/tweet?text=${t}&url=${u}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ['WhatsApp', `https://wa.me/?text=${t}%20${u}`],
  ];
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied('ok'); } catch { setCopied('fail'); }
    setTimeout(() => setCopied('idle'), 2500);
  }
  async function nativeShare() { try { await navigator.share({ title, url }); } catch { /* dismissed by the reader */ } }
  return (
    <div className="share" role="group" aria-label="Share this article">
      <span className="share__label">Share</span>
      {canShare ? <button type="button" className="share__btn" onClick={nativeShare}><Share2 size={16} aria-hidden="true" /> Share</button> : null}
      {targets.map(([name, href]) => (
        <a key={name} className="share__btn" href={href} target="_blank" rel="noopener noreferrer">{name}<span className="sr-only"> (opens in a new tab)</span></a>
      ))}
      <a className="share__btn" href={`mailto:?subject=${t}&body=${u}`}><Mail size={16} aria-hidden="true" /> Email</a>
      <button type="button" className="share__btn" onClick={copy}>
        {copied === 'ok' ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />} {copied === 'ok' ? 'Link copied' : 'Copy link'}
      </button>
      <span className="sr-only" role="status" aria-live="polite">{copied === 'ok' ? 'Link copied to clipboard' : copied === 'fail' ? 'Could not copy the link' : ''}</span>
    </div>
  );
}
