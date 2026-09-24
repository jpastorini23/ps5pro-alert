import { CONFIG } from './config.js';

// Some words never belong to a console listing — a cover is a cover even
// when its title says "Console Cover". Others (a bundled controller, an
// included game) appear inside genuine console titles, so those only
// disqualify when nothing marks the listing as a console.
const CONSOLE_MARKER = /(console|gaming system|\d\s*TB\b)/i;
const HARD_ACCESSORY = /(cover|faceplate|skin|case|stand|mount|charging|dock|disc drive|media remote|headset|poster|bag|bundle case)/i;
const SOFT_ACCESSORY = /(controller|game|remote)/i;
const NOT_NEW = /(refurb|renew|pre-?owned|open[- ]box|\bused\b|geek squad)/i;

// Returns the model a listing belongs to, or null if it is not one he wants.
export function classify(title) {
  const clean = (title ?? '').replace(/&#\\d+;|®|™/g, ' ').trim();
  if (!clean || NOT_NEW.test(clean)) return null;
  if (HARD_ACCESSORY.test(clean)) return null;
  if (!CONSOLE_MARKER.test(clean) && SOFT_ACCESSORY.test(clean)) return null;
  for (const m of CONFIG.models) {
    if (m.match.test(clean) && !(m.exclude && m.exclude.test(clean))) return m;
  }
  return null;
}

export function withinCeiling(model, price) {
  return price != null && model != null && price <= model.maxPrice;
}
