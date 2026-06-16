const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function getRequestOrigin(req) {
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  }

  const protocolHeader = req.headers['x-forwarded-proto'];
  const protocol = protocolHeader ? String(protocolHeader).split(',')[0] : req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

function isMediaPath(pathname) {
  return pathname.startsWith('/uploads/') || pathname.startsWith('/assets/') || pathname.startsWith('/api/media/');
}

function normalizeMediaUrlForStorage(value) {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (LOCAL_HOSTS.has(parsed.hostname) && isMediaPath(parsed.pathname)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return value;
  }

  return value;
}

function toAbsoluteUrl(req, value) {
  if (typeof value !== 'string') {
    return value;
  }

  if (isMediaPath(value)) {
    return `${getRequestOrigin(req)}${value}`;
  }

  try {
    const parsed = new URL(value);
    if (LOCAL_HOSTS.has(parsed.hostname) && isMediaPath(parsed.pathname)) {
      return `${getRequestOrigin(req)}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return value;
  }

  return value;
}

function transformDeep(value, transformer) {
  if (Array.isArray(value)) {
    return value.map((item) => transformDeep(item, transformer));
  }

  const isPlainObject =
    value &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

  if (isPlainObject) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, transformDeep(nestedValue, transformer)])
    );
  }

  return transformer(value);
}

function normalizeMediaFieldsForStorage(value) {
  return transformDeep(value, normalizeMediaUrlForStorage);
}

function hydrateMediaFieldsForResponse(req, value) {
  return transformDeep(value, (entry) => toAbsoluteUrl(req, entry));
}

module.exports = {
  getRequestOrigin,
  normalizeMediaFieldsForStorage,
  hydrateMediaFieldsForResponse,
  toAbsoluteUrl
};
