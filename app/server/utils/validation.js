const mongoose = require('mongoose');

function stringField(value, { name = 'Field', required = false, max = 1000, min = 0 } = {}) {
  if (value == null || value === '') {
    if (required) throw new Error(`${name} is required`);
    return '';
  }
  if (typeof value !== 'string') throw new Error(`${name} must be text`);
  const result = value.trim();
  if (required && !result) throw new Error(`${name} is required`);
  if (result.length < min || result.length > max) throw new Error(`${name} must be between ${min} and ${max} characters`);
  return result;
}

function emailField(value, name = 'Email') {
  const email = stringField(value, { name, required: true, max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${name} is invalid`);
  return email;
}

function objectId(value, name = 'ID') {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) throw new Error(`${name} is invalid`);
  return value;
}

function safeHttpUrl(value, { name = 'URL', allowRelative = true, max = 2048 } = {}) {
  const input = stringField(value, { name, max });
  if (!input) return '';
  if (allowRelative && /^\/(?!\/)/.test(input)) return input;
  let parsed;
  try { parsed = new URL(input); } catch { throw new Error(`${name} is invalid`); }
  if (!['https:', ...(process.env.NODE_ENV !== 'production' ? ['http:'] : [])].includes(parsed.protocol)) throw new Error(`${name} must use HTTPS`);
  if (parsed.username || parsed.password) throw new Error(`${name} is invalid`);
  return parsed.toString();
}

module.exports = { stringField, emailField, objectId, safeHttpUrl };
