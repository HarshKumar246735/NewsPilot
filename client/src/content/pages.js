// Policy and company pages. Text is parameterised by the publisher's own site settings.
// These are general-purpose drafts for a small digital publication: have them reviewed against your
// actual practices (and, for legal pages, by a qualified professional) before launch.
const UPDATED = '2026-10-10';

export function getStaticPage(slug, site) {
  const n = site.name;
  const mail = site.contact?.email;
  const reach = mail ? `Write to us at ${mail}.` : `Use the contact details published on our Contact page.`;
  const pages = {
    about: {
      title: `About ${n}`, description: `${n} publishes original news, explainers and practical guides for readers in India and around the world.`,
      sections: [
        { h: 'What we do', p: [`${n} is an independent digital publication. We publish original reporting, explainers and practical guides on India, world affairs, business, technology, science, education, sport and culture.`, `Our aim is simple: help readers understand what is happening and what it means for them, in plain language and without clutter.`] },
        { h: 'How we work', p: [`Every article carries a named author and a publication date. When we update a story we say so and show the updated date. Our standards are set out in our editorial policy, and we publish a corrections policy so mistakes are fixed openly.`] },
        
      ],
    },
    contact: {
      title: 'Contact us', description: `How to reach the ${n} editorial team, report an error or ask about advertising.`,
      sections: [
        { h: 'Editorial team', p: [`${reach} Please include the article link when you write about a specific story.`] },
        { h: 'Report an error', p: [`If you think we got something wrong, tell us. Corrections are handled as described in our corrections policy.`] },
        { h: 'Advertising and partnerships', p: [`For advertising, sponsorship and partnership enquiries, see Advertise with us.`] },
      ],
    },
    'editorial-policy': {
      title: 'Editorial policy', description: `The standards ${n} applies to sourcing, accuracy, independence and the use of automated tools.`,
      sections: [
        { h: 'Accuracy and sourcing', p: [`We report what we can verify. We prefer primary sources, name them where we can, and distinguish clearly between fact, analysis and opinion. We do not publish invented quotes, figures or sources.`] },
        { h: 'Independence', p: [`Advertisers, .`] },
        { h: 'Original work', p: [`We publish original work. We do not copy articles from other publications. When we draw on another outlet's reporting we credit and link to it.`] },
        { h: 'Automated tools', p: [`Software may help with tasks such as suggesting headlines or metadata. A person reviews anything before it is published, and tools are never used to generate facts we then present as reporting.`] },
        { h: 'Opinion', p: [`Opinion pieces are labelled and reflect the author's view, not the publication's.`] },
      ],
    },
    'corrections-policy': {
      title: 'Corrections policy', description: `How ${n} handles errors: what we correct, how we note it and how to report one.`,
      sections: [
        { h: 'Our commitment', p: [`When we get something wrong we correct it promptly and visibly. We do not quietly rewrite published facts.`] },
        { h: 'How corrections appear', p: [`Significant corrections are noted at the top or bottom of the article with the date. Minor fixes such as typos are made without a note. The updated date on the article reflects material changes.`] },
        { h: 'Report an error', p: [`${reach} Tell us the article, the passage and what you believe is incorrect, with a source if you have one.`] },
      ],
    },
    'privacy-policy': {
      title: 'Privacy policy', description: `What personal data ${n} collects, why, and the choices readers have.`,
      sections: [
        { h: 'What we collect', p: [`Reading ${n} does not require an account. We may collect technical data such as device type, pages viewed and approximate location through analytics, and the email address you give us if you join our newsletter.`] },
        { h: 'How we use it', p: [`We use analytics to understand which content is useful and to keep the site fast and secure. We use your email address only to send the newsletter you asked for.`] },
        { h: 'Advertising and cookies', p: [`Third-party advertising partners may use cookies to show ads and measure performance. Where required by law we ask for your consent first. See our cookie policy.`] },
        { h: 'Your choices', p: [`You can unsubscribe from the newsletter at any time using the link in every email. You can ask us to access, correct or delete your personal data. ${reach}`] },
        { h: 'Children', p: [`${n} is a general-audience publication and is not directed at children under 13.`] },
      ],
    },
    terms: {
      title: 'Terms and conditions', description: `The terms for using ${n}.`,
      sections: [
        { h: 'Using this site', p: [`By using ${n} you agree to these terms. You may read and share links to our articles for personal, non-commercial use.`] },
        { h: 'Our content', p: [`Articles, images and design are protected by copyright. You may quote short excerpts with attribution and a link. You may not republish full articles or scrape the site without written permission.`] },
        { h: 'Links and third parties', p: [`We link to other sites and are not responsible for their content or practices.`] },
        { h: 'Changes', p: [`We may update these terms. Continued use of the site after a change means you accept the updated terms.`] },
      ],
    },
    disclaimer: {
      title: 'Disclaimer', description: `General information, not professional advice: the limits of ${n}'s content.`,
      sections: [
        { h: 'General information only', p: [`Content on ${n} is provided for general information. It is not legal, medical, financial, investment or other professional advice. Speak to a qualified professional before making decisions that matter.`] },
        { h: 'Accuracy', p: [`We work hard to be accurate and correct errors when we find them, but we cannot guarantee that every article is complete or current.`] },
      ],
    },
    'cookie-policy': {
      title: 'Cookie policy', description: `The cookies and similar technologies ${n} uses and how to control them.`,
      sections: [
        { h: 'What cookies are', p: [`Cookies are small files stored on your device. They help sites work, remember preferences and measure usage.`] },
        { h: 'How we use them', p: [`We use essential cookies for security and basic functionality, analytics cookies to understand how the site is used, and, where advertising is enabled, advertising cookies set by our partners.`] },
        { h: 'Your choices', p: [`You can block or delete cookies in your browser settings. Blocking some cookies may affect parts of the site.`] },
      ],
    },
    
    advertise: {
      title: 'Advertise with us', description: `Advertising, sponsored content and partnership options on ${n}.`,
      sections: [
        { h: 'Reach our readers', p: [`${n} offers display advertising and clearly labelled sponsored content to reach readers in India and worldwide.`] },
        { h: 'Our principles', p: [`All paid placements are labelled. Sponsored articles are marked as sponsored and are separate from our editorial work. We do not accept deceptive formats or placements designed to trigger accidental clicks.`] },
        { h: 'Get in touch', p: [`${reach} Tell us about your goals and timing and we will respond with options.`] },
      ],
    },
  };
  const p = pages[slug];
  return p ? { slug, updated: UPDATED, ...p } : null;
}
