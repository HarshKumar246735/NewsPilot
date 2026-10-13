import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.js';
import { subscribeNewsletter } from '../services/apiSource.js';
import './Newsletter.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Newsletter() {
  const { config, shell } = useApp();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState({ status: 'idle', message: '' });
  const connected = Boolean(config.apiUrl);

  async function submit(e) {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) return setState({ status: 'error', message: 'Enter a valid email address.' });
    if (!consent) return setState({ status: 'error', message: 'Please tick the box to confirm you want to receive the newsletter.' });
    setState({ status: 'sending', message: '' });
    try {
      const r = await subscribeNewsletter(config, { email: email.trim(), consent: true });
      setState({ status: 'done', message: r.message || 'You are subscribed. Thank you.' });
      setEmail(''); setConsent(false);
    } catch (err) {
      setState({ status: 'error', message: err.message || 'Something went wrong. Please try again.' });
    }
  }

  return (
    <section className="newsletter" id="newsletter" aria-labelledby="newsletter-title">
      <div className="container newsletter__inner">
        <div className="newsletter__copy">
          <h2 id="newsletter-title">The {shell.site.name} briefing</h2>
          <p>A short, carefully edited summary of the stories worth your time. No spam, and you can leave at any time.</p>
        </div>
        {state.status === 'done' ? (
          <p className="newsletter__done" role="status">{state.message}</p>
        ) : (
          <form className="newsletter__form" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="nl-email">Email address</label>
              <input id="nl-email" className="input" type="email" autoComplete="email" inputMode="email" value={email}
                onChange={(e) => setEmail(e.target.value)} disabled={!connected} aria-describedby="nl-status" />
            </div>
            <label className="newsletter__consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={!connected} />
              <span>I agree to receive the newsletter and have read the <Link to="/privacy-policy">privacy policy</Link>.</span>
            </label>
            <button type="submit" className="btn btn--primary" disabled={!connected || state.status === 'sending'}>
              {state.status === 'sending' ? 'Subscribing…' : 'Subscribe'}
            </button>
            <p id="nl-status" className={`newsletter__status${state.status === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">
              {!connected ? 'Newsletter signup will open once the publication’s API is connected.' : state.message}
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
