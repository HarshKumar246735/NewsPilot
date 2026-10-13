import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, signJwt, verifyJwt, sha1 } from '../src/lib/crypto.js';
import { sanitizeHtml, sanitizeText } from '../src/lib/sanitize.js';
import { validate, hasUnsafeKeys } from '../src/lib/validate.js';
import { createLimiter } from '../src/lib/limit.js';
import { imageInfo } from '../src/lib/imageInfo.js';

test('password hashing: verifies correct, rejects wrong, never stores plaintext, salts differ', async () => {
  const a = await hashPassword('correct horse battery'), b = await hashPassword('correct horse battery');
  assert.notEqual(a, b); assert.ok(!a.includes('correct'));
  assert.equal(await verifyPassword('correct horse battery', a), true);
  assert.equal(await verifyPassword('wrong', a), false);
  assert.equal(await verifyPassword('x', 'garbage'), false);
});

test('JWT: round trip, tamper, wrong secret, expiry, alg:none', () => {
  const t = signJwt({ sub: 'u1', role: 'admin' }, 's'.repeat(32), { now: 1_000_000 });
  assert.equal(verifyJwt(t, 's'.repeat(32), { now: 1_000_500 }).sub, 'u1');
  assert.equal(verifyJwt(t, 'x'.repeat(32), { now: 1_000_500 }), null);
  assert.equal(verifyJwt(t, 's'.repeat(32), { now: 1_000_000 + 9 * 3600e3 }), null);
  const [h, p, s] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: 'u1', role: 'admin', exp: 9e9 })).toString('base64url');
  assert.equal(verifyJwt(`${h}.${forged}.${s}`, 's'.repeat(32), { now: 1_000_500 }), null);
  const none = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  assert.equal(verifyJwt(`${none}.${p}.`, 's'.repeat(32), { now: 1_000_500 }), null);
});

const attacks = [
  '<script>alert(1)</script>', '<SCRIPT SRC=//evil.js></SCRIPT>', '<img src=x onerror=alert(1)>', '<img src="javascript:alert(1)">',
  '<a href="javascript:alert(1)">x</a>', '<a href=" JaVaScRiPt:alert(1)">x</a>', '<a href="java&#x09;script:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>', '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>', '<a href="vbscript:x">x</a>',
  '<svg onload=alert(1)><circle/></svg>', '<iframe src="https://evil.example"></iframe>', '<iframe src="javascript:alert(1)"></iframe>',
  '<style>body{x:expression(alert(1))}</style>', '<p onclick="alert(1)">x</p>', '<<script>alert(1)//<</script>', '<math><mi xlink:href="javascript:alert(1)">',
  '<object data="x"></object>', '<form action="//evil"><button>go</button></form>', '<div style="background:url(javascript:alert(1))">x</div>',
  '<a href="https://ok.example" onmouseover="alert(1)">x</a>', '<img src="https://ok.example/a.jpg" onload="alert(1)">', '<body onload=alert(1)>', '<meta http-equiv="refresh" content="0;url=//evil">',
  '<img src="data:image/svg+xml;base64,PHN2Zz4=">', '<a href="//evil.example">x</a>',
];
test('sanitizer neutralises a battery of XSS payloads', () => {
  for (const a of attacks) {
    const out = sanitizeHtml(a);
    assert.ok(!/<script|<svg|<style|<object|<form|<meta|<body|<math/i.test(out), `${a} -> ${out}`);
    assert.ok(!/\son\w+\s*=/i.test(out), `${a} -> ${out}`);
    assert.ok(!/javascript:|vbscript:|data:text|expression\(/i.test(out.replace(/&#[xX]?\w+;/g, '')), `${a} -> ${out}`);
    assert.ok(!/<iframe/i.test(out), `${a} -> ${out}`);
    assert.ok(!/(href|src)="\/\/evil/i.test(out), `${a} -> ${out}`);
  }
});
test('sanitizer keeps legitimate article markup', () => {
  const html = '<h2 id="intro">Intro</h2><p>Hi <strong>there</strong> &amp; <em>you</em> <a href="https://example.org/x?a=1&b=2">link</a></p><ul><li>one</li></ul><blockquote><p>q</p></blockquote>'
    + '<figure><img src="https://res.cloudinary.com/x/image/upload/a.jpg" alt="A cat" width="800" height="500"><figcaption>cap</figcaption></figure><table><thead><tr><th>A</th></tr></thead><tbody><tr><td colspan="2">1</td></tr></tbody></table>';
  const out = sanitizeHtml(html);
  for (const keep of ['<h2 id="intro">', '<strong>there</strong>', '&amp;', '<ul><li>one</li></ul>', '<blockquote>', 'alt="A cat"', 'width="800"', '<figcaption>cap</figcaption>', '<td colspan="2">1</td>', 'href="https://example.org/x?a=1&amp;b=2"']) assert.ok(out.includes(keep), `${keep} missing in ${out}`);
  assert.match(out, /rel="noopener noreferrer"/);
});
test('sanitizer: YouTube embeds allowed, others not; unclosed tags are balanced; stray text escaped', () => {
  assert.match(sanitizeHtml('<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>'), /<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ"/);
  assert.equal(sanitizeHtml('<p>one<strong>two'), '<p>one<strong>two</strong></p>');
  assert.equal(sanitizeHtml('a < b > c'), 'a &lt; b &gt; c');
  assert.equal(sanitizeHtml('<p>x</p></div></p>'), '<p>x</p>');
  assert.equal(sanitizeText('<b>hi</b> <script>x</script> there'), 'hi x there');
});

test('validator: required, types, trimming, unknown keys dropped, partial mode, errors are field-level', () => {
  const rules = { title: { type: 'string', required: true, max: 10 }, email: { type: 'email' }, n: { type: 'number', min: 1, max: 5, int: true }, flag: { type: 'boolean', default: false }, tags: { type: 'array', items: { type: 'string', max: 3 }, max: 2 } };
  assert.deepEqual(validate({ title: '  Hi ', email: 'A@B.CO', n: '3', evil: 1 }, rules), { title: 'Hi', email: 'a@b.co', n: 3, flag: false });
  assert.throws(() => validate({}, rules), (e) => e.status === 422 && Boolean(e.details.fields.title));
  assert.throws(() => validate({ title: 'x', tags: ['toolong'] }, rules), (e) => e.status === 422);
  assert.throws(() => validate({ title: 'x', n: 9 }, rules), (e) => Boolean(e.details.fields.n));
  assert.deepEqual(validate({ n: 2 }, rules, { partial: true }), { n: 2 });
  assert.ok(hasUnsafeKeys({ a: { $gt: '' } })); assert.ok(hasUnsafeKeys({ 'a.b': 1 })); assert.ok(hasUnsafeKeys(JSON.parse('{"__proto__":{"x":1}}'))); assert.ok(!hasUnsafeKeys({ a: [{ b: 1 }] }));
});

test('rate limiter blocks after max within the window and recovers after it', () => {
  let t = 0; const lim = createLimiter({ windowMs: 1000, max: 2, now: () => t, key: () => 'k' });
  const run = () => { let err; lim({ ip: 1 }, { set() {} }, (e) => { err = e; }); return err; };
  assert.equal(run(), undefined); assert.equal(run(), undefined); assert.equal(run().status, 429);
  t = 1500; assert.equal(run(), undefined);
});

test('image sniffing reads real headers and rejects non-images', () => {
  const png = Buffer.alloc(33); png.writeUInt32BE(0x89504e47, 0); png.write('IHDR', 12, 'ascii'); png.writeUInt32BE(640, 16); png.writeUInt32BE(480, 20);
  assert.deepEqual(imageInfo(png), { format: 'png', mime: 'image/png', width: 640, height: 480 });
  const gif = Buffer.alloc(30); gif.write('GIF89a', 0, 'ascii'); gif.writeUInt16LE(10, 6); gif.writeUInt16LE(20, 8);
  assert.equal(imageInfo(gif).height, 20);
  assert.equal(imageInfo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10"></svg>'.padEnd(40))), null);
  assert.equal(imageInfo(Buffer.from('MZ'.padEnd(40))), null);
});

test('sha1 matches a known vector (used for Cloudinary signatures)', () => assert.equal(sha1('abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d'));
