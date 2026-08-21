const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ISSUER = 'bestworth-api';
const AUDIENCE = 'bestworth-admin';
const COOKIE_NAME = 'bw_session';
const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;

let ephemeralSecret;

function getSecret() {
  const configured = String(process.env.JWT_SECRET || '');
  if (configured.length >= 32) return configured;
  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(64).toString('hex');
    console.warn('[security] JWT_SECRET is missing or shorter than 32 characters; using a temporary process secret. Set a strong JWT_SECRET in Render.');
  }
  return ephemeralSecret;
}

function signAuthToken(user) {
  return jwt.sign(
    { id: String(user._id), sv: Number(user.sessionVersion || 0) },
    getSecret(),
    { algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE, expiresIn: TOKEN_LIFETIME_SECONDS }
  );
}

function verifyAuthToken(token) {
  return jwt.verify(token, getSecret(), {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE
  });
}

function parseCookies(header = '') {
  return String(header).split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 1) return cookies;
    const key = part.slice(0, separator).trim();
    try { cookies[key] = decodeURIComponent(part.slice(separator + 1).trim()); } catch { /* ignore malformed cookies */ }
    return cookies;
  }, {});
}

function getRequestToken(req) {
  const authorization = String(req.headers?.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const bearer = match?.[1]?.trim();
  if (bearer && !['null', 'undefined', 'cookie-session'].includes(bearer)) return bearer;
  return parseCookies(req.headers?.cookie)[COOKIE_NAME] || '';
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: TOKEN_LIFETIME_SECONDS * 1000
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
}

module.exports = { signAuthToken, verifyAuthToken, getRequestToken, setSessionCookie, clearSessionCookie, getSecret, COOKIE_NAME };
