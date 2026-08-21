const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'production';

const { rejectOperatorInjection, sameOriginWrites, securityHeaders } = require('../middleware/security');
const { stringField, emailField, objectId, safeHttpUrl, escapeRegex } = require('../utils/validation');
const { escapeHtml } = require('../utils/email');

function runGuard({ body = {}, query = {}, params = {} }) {
  let status = 0;
  const req = { body, query, params };
  const res = { status(code) { status = code; return this; }, json() { return this; } };
  rejectOperatorInjection(req, res, () => { status = 200; });
  return status;
}

test('NoSQL injection matrix is rejected in bodies, queries, params, arrays, and parsed JSON', () => {
  const attacks = [
    { body: { username: { $ne: null } } },
    { body: { password: { $gt: '' } } },
    { body: { filter: { $where: 'sleep(1000)' } } },
    { body: { items: [{ nested: { $regex: '.*' } }] } },
    { query: { '$or': [{ role: 'admin' }] } },
    { query: { 'profile.role': 'admin' } },
    { params: { '$eq': 'anything' } },
    { body: JSON.parse('{"__proto__":{"polluted":true}}') },
    { body: { constructor: { prototype: { polluted: true } } } }
  ];
  for (const attack of attacks) assert.equal(runGuard(attack), 400);
  assert.equal(runGuard({ body: { name: 'Normal Customer', message: 'Need roofing nails' } }), 200);
  assert.equal({}.polluted, undefined);
});

test('excessively deep payloads are rejected instead of bypassing recursive inspection', () => {
  let payload = { safe: true };
  for (let index = 0; index < 22; index += 1) payload = { nested: payload };
  assert.equal(runGuard({ body: payload }), 400);
});

test('type-confusion payloads cannot become strings used by authentication or forms', () => {
  for (const value of [{ $ne: '' }, ['$gt'], 42, true]) {
    assert.throws(() => stringField(value, { name: 'Input', required: true }), /must be text/);
  }
  assert.throws(() => emailField('admin@example.com\nBcc: attacker@example.com'), /invalid/);
  assert.throws(() => objectId('507f1f77bcf86cd799439011{$ne:1}'), /invalid/);
});

test('regex metacharacters are escaped and search input is bounded', () => {
  const escaped = escapeRegex('.*(a+)+$[test]{1,999999}', 100);
  assert.equal(escaped, '\\.\\*\\(a\\+\\)\\+\\$\\[test\\]\\{1,999999\\}');
  assert.ok(escapeRegex('x'.repeat(1000), 100).length <= 100);
});

test('unsafe URL schemes and credential-bearing URLs are rejected', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'https://user:pass@example.com/file']) {
    assert.throws(() => safeHttpUrl(url, { name: 'URL' }));
  }
  assert.throws(() => safeHttpUrl('http://example.com/file', { name: 'URL' }), /HTTPS/);
});

test('HTML payloads are escaped before entering transactional email content', () => {
  const payload = '<img src=x onerror="alert(1)"><script>steal()</script>';
  const escaped = escapeHtml(payload);
  assert.equal(escaped.includes('<script>'), false);
  assert.match(escaped, /&lt;script&gt;/);
  assert.match(escaped, /&quot;alert/);
});

test('cross-origin state-changing requests are rejected', () => {
  process.env.PUBLIC_APP_URL = 'https://bestworthproductsltd.ng';
  let status = 0;
  const response = { status(code) { status = code; return this; }, json() { return this; } };
  sameOriginWrites({ method: 'POST', headers: { origin: 'https://attacker.example' } }, response, () => { status = 200; });
  assert.equal(status, 403);
  sameOriginWrites({ method: 'POST', headers: { origin: 'https://bestworthproductsltd.ng' } }, response, () => { status = 200; });
  assert.equal(status, 200);
});

test('security headers block MIME sniffing, cross-site framing, and unsafe defaults', () => {
  const headers = {};
  securityHeaders({}, { setHeader(name, value) { headers[name] = value; } }, () => {});
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
  assert.match(headers['Content-Security-Policy'], /object-src 'none'/);
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'self'/);
});
