import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestInternalLinks } from '../src/seo/index.js';
test('internal link suggestions only return relevant, existing, published candidates', () => {
  const draft = { id: 'd', slug: 'new', title: 'React hooks tutorial for beginners', contentHtml: '<p>React hooks let you use state in components. Learn React hooks step by step.</p>' };
  const pool = [
    { id: '1', slug: 'js-basics', title: 'JavaScript fundamentals every React learner needs', tags: ['javascript'], excerpt: 'Before React hooks, learn the language.' },
    { id: '2', slug: 'monsoon', title: 'What a monsoon forecast tells you', tags: ['weather'], excerpt: 'Rain odds.' },
    { id: 'd', slug: 'new', title: 'self', tags: [] },
  ];
  const out = suggestInternalLinks(draft, pool, { siteUrl: 'https://x.org' });
  assert.deepEqual(out.map((o) => o.id), ['1']);
  assert.equal(out[0].url, 'https://x.org/article/js-basics');
});
