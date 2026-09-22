import { get } from './http.js';
import { classify } from '../models.js';

const ORIGIN = 'https://direct.playstation.com';
const LISTING = `${ORIGIN}/en-us/consoles`;

// PSDIRECT_URL pins a single product — used to exercise the alert path
// against something that is actually in stock.
const PINNED = process.env.PSDIRECT_URL;

export const id = 'psdirect';
export const label = 'PlayStation Direct';
// Sony drops are queued rather than flickering; a slower poll is enough.
export const minIntervalSeconds = 60;

let cachedPages = null;

// Every console Sony lists that matches a watched model, discovered rather
// than hardcoded. The slug carries enough to classify before fetching.
async function discover() {
  const html = await get(LISTING);
  const links = new Set();
  for (const m of html.matchAll(/href="(\/en-us\/(?:buy-consoles|bundles)\/[^"]+)"/g)) {
    const slug = m[1].split('/').pop().replace(/-/g, ' ');
    if (classify(slug)) links.add(ORIGIN + m[1]);
  }
  if (links.size === 0) throw new Error('no watched console found on the consoles page');
  return [...links];
}

async function readProduct(url) {
  const html = await get(url);

  // Gotcha: this page emits http://schema.org/InStock but
  // https://schema.org/OutOfStock. Match protocol-agnostically or a
  // real restock is silently missed.
  const avail = html.match(/itemprop="availability"\s+href="https?:\/\/schema\.org\/(\w+)"/i);
  if (!avail) throw new Error(`availability marker not found at ${url}`);

  const price = html.match(/productPrice:"([\d.]+)"/);
  const name = html.match(/<title>\s*([^<|]+)/);
  const title = (name ? name[1] : url.split('/').pop().replace(/-/g, ' ')).trim();

  // Classify on the real product title, which is more reliable than the slug.
  const model = classify(title);
  if (!model) return null;

  return {
    key: `psdirect:${url.split('/').pop()}`,
    channel: 'Sony official store',
    inStock: /^InStock$/i.test(avail[1]),
    price: price ? Number(price[1]) : null,
    model,
    url,
    note: `${title.slice(0, 60)} · ships to a US address`,
  };
}

export async function check({ deep = true } = {}) {
  if (PINNED) return [await readProduct(PINNED)].filter(Boolean);
  if (deep || !cachedPages) cachedPages = await discover();
  return (await Promise.all(cachedPages.map(readProduct))).filter(Boolean);
}
