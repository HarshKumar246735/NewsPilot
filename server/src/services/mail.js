// Sends transactional email through the Resend REST API when RESEND_API_KEY and MAIL_FROM are set.
// Not exercised by the offline test suite (needs a real account); when unconfigured it reports { sent: false }.
export function createMailer({ config, fetchImpl = globalThis.fetch }) {
  return {
    enabled: config.mail.enabled,
    async send({ to, subject, html }) {
      if (!config.mail.enabled) return { sent: false, reason: 'not-configured' };
      try {
        const res = await fetchImpl('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${config.mail.resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: config.mail.from, to, subject, html }) });
        return res.ok ? { sent: true } : { sent: false, reason: `provider-${res.status}` };
      } catch { return { sent: false, reason: 'network' }; }
    },
  };
}
