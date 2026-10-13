// DEMONSTRATION CONTENT ONLY. Fictional staff, evergreen explainers, no real events, people or quotes.
// Used solely when NP_DEMO=true on a build made with `npm run build:demo`. Never shipped by `npm run build`.
import { slugify, readingMinutes } from '../seo.js';
import { DEMO_IMAGE_ALTS } from './imageManifest.js';

const C = (slug, name, parentSlug, extra = {}) => ({ slug, name, parentSlug: parentSlug || null, ...extra });
export const CATEGORIES = [
  C('india', 'India', null, { primary: true, description: 'Reporting and explainers on life, policy and infrastructure across India.' }),
  C('world', 'World', null, { primary: true, description: 'International affairs, trade and global trends explained.' }),
  C('politics', 'Politics', null, { primary: true, description: 'How governments, elections and public institutions work.' }),
  C('business', 'Business', null, { primary: true, description: 'Companies, markets and the household economy.' }),
  C('technology', 'Technology', null, { primary: true, description: 'Technology news, tools and practical guidance.' }),
  C('science', 'Science', null, { primary: true, description: 'Discoveries and ideas from science, explained clearly.' }),
  C('education', 'Education', null, { description: 'Exams, careers and learning.' }),
  C('sports', 'Sports', null, { primary: true, description: 'Analysis and stories from the world of sport.' }),
  C('entertainment', 'Entertainment', null, { primary: true, description: 'Film, streaming, music and games.' }),
  C('health', 'Health', null, { description: 'Evidence-based health and wellbeing.' }),
  C('lifestyle', 'Lifestyle', null, { description: 'Travel, food and everyday living.' }),
  C('opinion', 'Opinion', null, { description: 'Signed opinion and commentary.' }),
  C('finance', 'Finance', 'business', { description: 'Personal finance, markets and money explained.' }),
  C('real-estate', 'Real Estate', 'business'),
  C('automobile', 'Automobile', 'business'),
  C('artificial-intelligence', 'Artificial Intelligence', 'technology', { description: 'What AI tools can and cannot do, explained plainly.' }),
  C('cybersecurity', 'Cybersecurity', 'technology', { description: 'Practical security guidance for people and small teams.' }),
  C('programming', 'Programming', 'technology', { description: 'Guides and ideas for people learning to code.' }),
  C('product-reviews', 'Product Reviews', 'technology'),
  C('environment', 'Environment', 'science', { description: 'Climate, weather and the natural world.' }),
  C('jobs-careers', 'Jobs & Careers', 'education'),
  C('government-jobs', 'Government Jobs', 'education', { description: 'How public-sector recruitment works.' }),
  C('exams-results', 'Exams & Results', 'education'),
  C('cricket', 'Cricket', 'sports', { description: 'Cricket analysis and features.' }),
  C('bollywood', 'Bollywood', 'entertainment'),
  C('hollywood', 'Hollywood', 'entertainment'),
  C('gaming', 'Gaming', 'entertainment', { description: 'Games, studios and the industry behind them.' }),
  C('fitness', 'Fitness', 'health', { description: 'Training and recovery guidance.' }),
  C('travel', 'Travel', 'lifestyle'),
  C('food', 'Food', 'lifestyle', { description: 'Cooking methods and food culture.' }),
  C('how-to-guides', 'How-To Guides', 'lifestyle'),
  C('regional-news', 'Regional News', 'india'),
].map((c, i) => ({ ...c, order: i }));

export const AUTHORS = [
  { slug: 'ananya-rao', name: 'Ananya Rao', bio: 'Ananya Rao is a demonstration author who covers technology, business and personal finance.' },
  { slug: 'rohan-mehta', name: 'Rohan Mehta', bio: 'Rohan Mehta is a demonstration author who writes about cities, careers and public services.' },
  { slug: 'sara-whitfield', name: 'Sara Whitfield', bio: 'Sara Whitfield is a demonstration author who covers science, health and global affairs.' },
];

// Tiny markup -> HTML: "## h2", "### h3", "> quote", "- item", "| a | b |" table rows, otherwise a paragraph.
function md(lines) {
  const out = []; let list = [], table = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((i) => `<li>${i}</li>`).join('')}</ul>`), (list = []);
    if (table.length) {
      const [head, ...rows] = table.map((r) => r.split('|').slice(1, -1).map((c) => c.trim()));
      out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      table = [];
    }
  };
  for (const l of lines) {
    if (l.startsWith('- ')) { if (table.length) flush(); list.push(l.slice(2)); continue; }
    if (l.startsWith('|')) { if (list.length) flush(); table.push(l); continue; }
    flush();
    if (l.startsWith('### ')) out.push(`<h3>${l.slice(4)}</h3>`);
    else if (l.startsWith('## ')) out.push(`<h2>${l.slice(3)}</h2>`);
    else if (l.startsWith('> ')) out.push(`<blockquote><p>${l.slice(2)}</p></blockquote>`);
    else out.push(`<p>${l}</p>`);
  }
  flush();
  return out.join('\n');
}

// t title, d dek, c category, a author index, h hours ago, f flags, b body lines
const RAW = [
  { t: 'What a monsoon forecast actually tells you, and what it doesn\'t', d: 'Seasonal outlooks are probabilities about averages, not promises about the weather on your street. Here is how to read one.', c: 'india', a: 2, h: 2, f: 'hero', tags: ['monsoon', 'weather', 'explainer'], cap: 'Demonstration artwork. Real articles use editorial photography.', b: [
    'Every year, forecasters publish an outlook for the rainy season, and every year the headline number is compared with what happens next. The comparison is usually unfair, because the two numbers answer different questions.',
    '## What the headline number measures',
    'A seasonal forecast describes the expected total rainfall across a large region over several months, expressed against a long-term average. It says nothing reliable about the rain on a particular day, in a particular district.',
    '- It is a probability, not a guarantee: "above normal" means more likely than not.',
    '- It covers a broad region, so local totals can differ sharply.',
    '- It covers a whole season, so dry spells and heavy bursts can both occur inside a normal total.',
    '## Why the same season can feel very different',
    'Rainfall is uneven in time and space. A season can finish close to average because a few intense days made up for weeks of dry weather. For farmers and city drainage, that distribution matters more than the total.',
    '### Timing matters as much as volume',
    'A delayed onset or a long break in the middle of the season can stress crops even when the final total looks healthy. Short, intense bursts can overwhelm drains and cause flooding in a year labelled "normal".',
    '> A forecast is a statement about odds. Judge it over many seasons, not one.',
    '## How to read an outlook sensibly',
    '| Question to ask | Why it matters |', '| Which region does it cover? | Regional totals hide local variation |', '| How is "normal" defined? | The baseline period changes the label |', '| When will it be updated? | Forecasts are revised as conditions develop |',
    'Treat the outlook as context for planning, and follow short-range local forecasts for decisions that depend on the next few days.',
  ] },
  { t: 'How city planners decide where a new metro line goes', d: 'Ridership projections, land costs and construction risk all pull in different directions. A look at the trade-offs behind a route map.', c: 'india', a: 1, h: 8, f: 'hero2', tags: ['transport', 'cities'], b: [
    'A metro route looks inevitable once it is drawn on a map. In practice, planners compare dozens of alignments before one survives.',
    '## Demand first, then cost',
    'Planners estimate how many people would use each station and weigh that against land acquisition, utilities that must be moved and the difficulty of tunnelling or building on viaducts.',
    '## The trade-offs',
    '- Serving dense areas raises ridership but makes construction slower and more expensive.',
    '- Connecting to existing lines helps transfers but can overload interchange stations.',
    '- Elevated routes are cheaper but affect streetscapes and noise.',
    'The final choice is a compromise that rarely satisfies everyone, which is why public consultation and transparent assumptions matter.',
  ] },
  { t: 'Why shipping delays ripple into the prices on your shelf', d: 'A late container does not just delay one product. It changes what stores order, what they stock and what they charge.', c: 'world', a: 2, h: 13, f: 'hero2', tags: ['trade', 'prices'], b: [
    'International shipping is a chain of tightly scheduled handoffs. When one link slips, the delay spreads through everything downstream.',
    '## From port to price tag',
    'Retailers plan orders weeks ahead. When goods arrive late, they pay more for faster alternatives, hold extra stock as a precaution, or run out of items. Each response adds cost.',
    '## Why some prices move more than others',
    'Products with thin margins and long supply chains are most exposed. Goods that are made locally or kept in large stock are less affected.',
    'Understanding the chain helps explain why a price can rise months after the original disruption has cleared.',
  ] },
  { t: 'How elections are audited: a primer on the process', d: 'Audits are how officials check that counted results match the paper record. The methods differ, but the logic is the same.', c: 'politics', a: 2, h: 10, f: '', tags: ['elections', 'explainer'], b: [
    'After votes are counted, many systems run a second check to confirm the result is accurate. This is an audit, and it is separate from a recount.',
    '## Audit versus recount',
    'A recount repeats the full count, usually in response to a close margin or a legal challenge. An audit samples a portion of ballots and compares them with the reported tally.',
    '## What a good audit needs',
    '- A reliable paper record to check against.',
    '- A sample chosen by a transparent random method.',
    '- Clear rules for what happens if the sample disagrees with the count.',
    'Audits do not replace the count. They give the public a documented reason to trust it.',
  ] },
  { t: 'A plain-language guide to reading a company\'s quarterly results', d: 'Revenue, profit, margin and guidance: what each line means and which ones deserve your attention first.', c: 'finance', a: 0, h: 4, f: 'guide', tags: ['markets', 'guide'], b: [
    'Quarterly results can look like a wall of numbers. A few lines carry most of the meaning.',
    '## Start with revenue and profit',
    'Revenue is what the company earned from selling goods and services. Profit is what remains after costs. Growing revenue with shrinking profit can signal rising costs.',
    '## Then look at margins',
    'Margin expresses profit as a share of revenue. Comparing it with previous quarters shows whether the business is becoming more or less efficient.',
    '## Finally, read the outlook',
    'Companies often share expectations for the next period. Compare it with what they said before, and note what changed.',
    '- Compare with the same quarter last year, not only the previous quarter.',
    '- Check whether one-off items distort the picture.',
    '- Read the notes, where companies explain unusual numbers.',
  ] },
  { t: 'Balancing a household budget when prices rise faster than pay', d: 'A practical way to sort spending into fixed, flexible and avoidable costs, and to decide what to trim first.', c: 'business', a: 0, h: 14, f: '', tags: ['budget', 'money'], b: [
    'When prices climb, a budget needs to be reviewed more often than once a year.',
    '## Sort spending into three groups',
    'Fixed costs such as rent rarely change. Flexible costs such as groceries can be trimmed. Avoidable costs, such as unused subscriptions, can be removed.',
    '## Start with the easy wins',
    'Cancel what you do not use, then compare providers for recurring bills. Only then reduce the flexible categories.',
    'Write down the plan and check it monthly. Small, early adjustments are easier than a large correction later.',
  ] },
  { t: 'How to evaluate an AI assistant before you rely on it', d: 'Run it through a short checklist of tasks you already know the answer to, and note where it hesitates, invents or overreaches.', c: 'artificial-intelligence', a: 0, h: 5, f: 'pick guide', tags: ['ai', 'guide'], b: [
    'AI assistants can be fluent and wrong at the same time. A short test before you depend on one saves time later.',
    '## Test with questions you can verify',
    'Ask about a topic you know well, and one with a documented answer such as a published figure. Check whether it cites sources and whether those sources exist.',
    '## Probe the edges',
    '- Ask something it cannot know, such as a private document, and see if it admits that.',
    '- Ask the same question twice and compare the answers.',
    '- Ask it to show its working on a calculation.',
    '## Decide what it is good for',
    'Drafting and brainstorming tolerate mistakes. Legal, medical and financial decisions do not. Match the tool to the stakes.',
  ] },
  { t: 'Seven habits that make home networks harder to attack', d: 'Most home break-ins online exploit defaults and old software. A few routine habits close the common doors.', c: 'cybersecurity', a: 0, h: 7, f: 'guide', tags: ['security', 'guide'], b: [
    'You do not need expert skills to make your network a harder target. Most attacks look for easy openings.',
    '## The habits',
    '- Change the default router password and admin name.',
    '- Keep router firmware and devices updated.',
    '- Use a long, unique Wi-Fi passphrase.',
    '- Turn off remote administration you do not use.',
    '- Put smart devices on a guest network.',
    '- Use a password manager and two-step verification.',
    '- Back up important files offline.',
    '## Make it routine',
    'Set a monthly reminder to check updates. Consistency matters more than perfection.',
  ] },
  { t: 'A beginner\'s map of the Python ecosystem', d: 'Libraries, tools and learning paths grouped by what you want to build, so you can pick a direction instead of everything at once.', c: 'programming', a: 0, h: 26, f: 'guide', tags: ['python', 'learning'], b: [
    'Python is used for web apps, data analysis, automation and more. That breadth can make it hard to know where to start.',
    '## Choose by goal',
    '- Automation: standard library modules and small scripts.',
    '- Data work: spreadsheets-style analysis and charts.',
    '- Web: frameworks for building sites and APIs.',
    '## Learn in a loop',
    'Build something small, read other people\'s code, then build something slightly harder. Projects teach faster than lists of topics.',
  ] },
  { t: 'Why indie game studios are returning to smaller worlds', d: 'Tighter scope, shorter development and clearer ideas: the case for making smaller games well.', c: 'gaming', a: 0, h: 22, f: 'pick', tags: ['games', 'industry'], b: [
    'Many small studios are choosing compact games over sprawling open worlds.',
    '## Scope is the biggest risk',
    'Large games need large teams and long schedules. A small, focused design is easier to finish, test and polish.',
    '## What players get',
    'Tighter pacing, clearer ideas and lower prices. Smaller games also let teams ship, learn and iterate.',
  ] },
  { t: 'How streaming platforms decide what to commission', d: 'Data, genre gaps and audience goals shape the slate. Here is how a project goes from pitch to greenlight.', c: 'entertainment', a: 2, h: 16, f: '', tags: ['streaming', 'industry'], b: [
    'A commissioning decision blends creative judgement with audience research.',
    '## The pitch',
    'Producers present a concept, a team and a budget. Executives compare it with what is already in the catalogue.',
    '## The filters',
    '- Does it fill a gap in the slate?',
    '- Does it suit a defined audience?',
    '- Can it be made on budget and on time?',
    'Many strong ideas fail on the last question rather than the first.',
  ] },
  { t: 'Behind the scenes of a film score: how composers work with picture', d: 'From spotting sessions to final mix, a composer\'s timeline is built around the edit.', c: 'bollywood', a: 1, h: 40, f: '', tags: ['film', 'music'], b: [
    'A film score is written to a moving target: the edit changes until late in the process.',
    '## Spotting',
    'The director and composer watch the cut and decide where music begins, ends and what it should do.',
    '## Writing to picture',
    'Composers sketch themes first, then fit them to scenes, adjusting timing as edits change.',
    'The final mix balances music with dialogue and sound effects.',
  ] },
  { t: 'Why the 20-over format keeps changing how batters train', d: 'Shorter formats reward different skills. Coaches explain how practice has changed to match.', c: 'cricket', a: 1, h: 3, f: 'hero2', tags: ['cricket', 'training'], b: [
    'Shorter formats have changed what coaches ask batters to practise.',
    '## Scoring options',
    'Batters now rehearse a wider range of shots and plan for particular bowlers and match situations.',
    '## Fitness and recovery',
    'Explosive power and quick recovery matter more, and training blocks are built around them.',
    'The result is a game in which preparation is as specific as the match itself.',
  ] },
  { t: 'What sleep trackers can and can\'t measure', d: 'Wearables are good at some things and weak at others. A guide to using the data without over-reading it.', c: 'health', a: 2, h: 6, f: 'pick', tags: ['sleep', 'wearables'], b: [
    'Sleep trackers estimate sleep from movement and heart rate. They are useful, but not laboratory instruments.',
    '## What they do reasonably well',
    'Tracking how long you were in bed and how regular your schedule is.',
    '## Where to be cautious',
    '- Sleep stage breakdowns are estimates.',
    '- Day-to-day changes can be noise.',
    '- A single bad night is not a trend.',
    'Use trends over weeks, and talk to a doctor if sleep problems persist.',
  ] },
  { t: 'Strength training twice a week: a realistic starting plan', d: 'Two short sessions can build a base. Here is a simple structure and how to progress it safely.', c: 'fitness', a: 2, h: 30, f: 'guide', tags: ['training', 'guide'], b: [
    'You do not need daily sessions to start. Two focused workouts a week build a base.',
    '## A simple structure',
    '- Choose one push, one pull, one leg and one core exercise.',
    '- Do two or three sets of a comfortable number of repetitions.',
    '- Rest a day between sessions.',
    '## Progress gradually',
    'Add a little weight or one repetition when the current load feels manageable. Stop if you feel sharp pain, and consult a professional if you have a health condition.',
  ] },
  { t: 'The science of why rain smells the way it does', d: 'The scent has a name and a chemistry. It comes from soil, plants and the way raindrops hit the ground.', c: 'science', a: 2, h: 12, f: '', tags: ['chemistry', 'weather'], b: [
    'The smell that arrives with the first rain after a dry spell is familiar to almost everyone.',
    '## Where the scent comes from',
    'Soil bacteria release compounds that collect in dry ground. Raindrops hitting the surface can throw tiny droplets into the air, carrying the scent with them.',
    '## Why we notice it',
    'Humans are unusually sensitive to these compounds, which may explain why the smell feels so distinct.',
  ] },
  { t: 'How coastal wetlands protect cities from storm surges', d: 'Marshes and mangroves slow water and absorb energy. Why restoring them is often cheaper than building walls alone.', c: 'environment', a: 2, h: 44, f: '', tags: ['coast', 'climate'], b: [
    'Wetlands act as a natural buffer between the sea and the city.',
    '## How they work',
    'Vegetation slows waves and spreads water out, which reduces its height and force when it reaches land.',
    '## The limits',
    'They do not replace engineered defences everywhere, but they can reduce the load on them.',
    'Protecting existing wetlands is usually cheaper than rebuilding them.',
  ] },
  { t: 'Reading the fine print on your first job offer', d: 'Pay, notice periods, probation and benefits: the clauses worth understanding before you sign.', c: 'jobs-careers', a: 1, h: 9, f: 'guide', tags: ['careers', 'guide'], b: [
    'A first offer letter can feel like a finish line. It is also a contract.',
    '## Clauses to read twice',
    '- Fixed and variable pay, and when variable pay is earned.',
    '- Probation length and notice periods.',
    '- Rules on outside work and confidentiality.',
    '## Ask before you sign',
    'It is normal to ask for clarification in writing. A good employer will answer plainly.',
  ] },
  { t: 'How exam-result portals handle sudden traffic spikes', d: 'Millions of students check results at the same minute. The engineering behind keeping a page standing.', c: 'exams-results', a: 0, h: 11, f: '', tags: ['exams', 'engineering'], b: [
    'On result day, a portal can receive more visits in a minute than in a normal month.',
    '## Cache the common case',
    'Static pages can be served from caches close to users, so the central system handles fewer requests.',
    '## Queue the rest',
    'Lookups are placed in queues and answered in order, so the system slows gracefully instead of failing.',
  ] },
  { t: 'Understanding the stages of a government recruitment cycle', d: 'From notification to joining letter: what happens at each stage and what candidates can prepare in advance.', c: 'government-jobs', a: 1, h: 18, f: 'guide', tags: ['recruitment', 'guide'], b: [
    'Recruitment cycles follow a predictable sequence even when details vary.',
    '## The stages',
    '- Notification and eligibility.',
    '- Application and fee.',
    '- Written examination.',
    '- Document verification and, in some cases, interview.',
    '- Merit list and joining.',
    '## Prepare early',
    'Keep documents ready and check official notifications regularly. Always rely on the official site, not on forwarded messages.',
  ] },
  { t: 'Opinion: newsrooms should publish their corrections more prominently', d: 'Readers trust outlets that admit mistakes openly. A case for putting corrections where people can see them.', c: 'opinion', a: 1, h: 20, f: 'opinion', tags: ['media', 'opinion'], b: [
    'A correction buried at the bottom of a page protects the publication more than the reader.',
    '## Visibility is a form of respect',
    'If an error mattered enough to fix, it matters enough to flag. A clear note at the top, with the date and the change, lets readers judge for themselves.',
    '## A standard worth adopting',
    'Publish a corrections policy, link to it from every article and make reporting an error easy. Trust is built by how mistakes are handled.',
  ] },
  { t: 'How to cook dal for a week: a batch-cooking method', d: 'One pot, three seasonings and a few storage rules turn a single cook into a week of varied meals.', c: 'food', a: 2, h: 27, f: 'guide', tags: ['cooking', 'guide'], b: [
    'Batch cooking works best when the base is simple and the finish is flexible.',
    '## Cook the base',
    'Cook a large pot of plain dal, then cool it quickly and store it in portions.',
    '## Finish differently each day',
    '- A cumin and garlic tempering.',
    '- Tomato and chilli.',
    '- Spinach and lemon.',
    'Refrigerate promptly and reheat until steaming hot.',
  ] },
];

const BASE = Date.now();
export function buildArticles() {
  const catBy = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));
  return RAW.map((r, i) => {
    const cat = catBy[r.c];
    const html = md(r.b);
    const publishedAt = new Date(BASE - r.h * 3600e3).toISOString();
    return {
      id: `demo-${i + 1}`, slug: slugify(r.t), title: r.t, dek: r.d, excerpt: r.d,
      category: { slug: cat.slug, name: cat.name, parentSlug: cat.parentSlug },
      author: { slug: AUTHORS[r.a].slug, name: AUTHORS[r.a].name },
      publishedAt, updatedAt: publishedAt, readingMinutes: Math.max(2, readingMinutes(html)),
      image: { url: `/demo/img-${String(i + 1).padStart(2, '0')}.svg`, width: 1600, height: 1000, alt: DEMO_IMAGE_ALTS[i], caption: r.cap || 'Demonstration artwork.', credit: 'NewsPilot demo' },
      tags: r.tags, flags: r.f.split(' ').filter(Boolean), contentHtml: html, isDemo: true, isNews: false,
    };
  }).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}
