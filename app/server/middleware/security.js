const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function allowedOrigins() {
  const configured = [process.env.PUBLIC_APP_URL, ...(process.env.CORS_ORIGINS || '').split(',')]
    .map((value) => String(value || '').trim().replace(/\/$/, ''))
    .filter(Boolean);
  try {
    const canonical = new URL(process.env.PUBLIC_APP_URL || '');
    const alternateHost = canonical.hostname.startsWith('www.') ? canonical.hostname.slice(4) : `www.${canonical.hostname}`;
    configured.push(`${canonical.protocol}//${alternateHost}${canonical.port ? `:${canonical.port}` : ''}`);
  } catch { /* PUBLIC_APP_URL is validated by deployment configuration */ }
  if (process.env.NODE_ENV !== 'production') configured.push('http://localhost:3000', 'http://127.0.0.1:3000');
  return new Set(configured);
}

function corsOrigin(origin, callback) {
  if (!origin || allowedOrigins().has(origin.replace(/\/$/, ''))) return callback(null, true);
  return callback(new Error('Origin not allowed'));
}

function sameOriginWrites(req, res, next) {
  if (SAFE_METHODS.has(req.method) || !req.headers.origin) return next();
  if (allowedOrigins().has(String(req.headers.origin).replace(/\/$/, ''))) return next();
  return res.status(403).json({ message: 'Request origin is not allowed.' });
}

function inspectKeys(value, depth = 0) {
  if (depth > 20 || value === null || typeof value !== 'object') return false;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.') || DANGEROUS_KEYS.has(key)) return true;
    if (inspectKeys(value[key], depth + 1)) return true;
  }
  return false;
}

function rejectOperatorInjection(req, res, next) {
  if (inspectKeys(req.body) || inspectKeys(req.query) || inspectKeys(req.params)) {
    return res.status(400).json({ message: 'Invalid request data.' });
  }
  next();
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' ws: wss: https:; frame-src 'self' https://www.google.com https://maps.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; form-action 'self'; upgrade-insecure-requests");
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

module.exports = { allowedOrigins, corsOrigin, sameOriginWrites, rejectOperatorInjection, securityHeaders };
