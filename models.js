import { CONFIG } from './config.js';

// Accessories, and anything that is not a new unit, never qualify.
const ACCESSORY = /(controller|cover|headset|game|stand|case|remote|charging|skin|faceplate|disc drive|media)/i;
const NOT_NEW = /(refurb|renew|pre-?owned|open[- ]box|\bused\b|geek squad)/i;

// Returns the model a listing belongs to, or null if it is not one he wants.
export function classify(title) {
  const clean = (title ?? '').replace(/&#\\d+;|®|™/g, ' ').trim();
  if (!clean || ACCESSORY.test(clean) || NOT_NEW.test(clean)) return null;
  for (const m of CONFIG.models) {
    if (m.match.test(clean) && !(m.exclude && m.exclude.test(clean))) return m;
  }
  return null;
}

export function withinCeiling(model, price) {
  return price != null && model != null && price <= model.maxPrice;
}
