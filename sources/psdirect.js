import { get } from './http.js';

// PSDIRECT_URL override exists so the alert path can be exercised against a
// product that is actually in stock, without waiting for a real restock.
const URL =
  process.env.PSDIRECT_URL ??
  'https://direct.playstation.com/en-us/buy-consoles/playstation5-pro-console-2-tb';

export const id = 'psdirect';
export const label = 'PlayStation Direct';

export async function check(_opts = {}) {
  const html = await get(URL);

  // Gotcha: the page emits http://schema.org/InStock but https://schema.org/OutOfStock.
  // Match protocol-agnostically or in-stock is silently missed.
  const m = html.match(/itemprop="availability"\s+href="https?:\/\/schema\.org\/(\w+)"/i);
  if (!m) throw new Error('availability marker not found — page structure changed');

  const status = m[1];
  const priceMatch = html.match(/productPrice:"([\d.]+)"/);
  const price = priceMatch ? Number(priceMatch[1]) : null;

  return [{
    key: 'psdirect:ship',
    channel: 'Sony official store',
    inStock: /^InStock$/i.test(status),
    price,
    url: URL,
    note: 'Ships to a US address only',
  }];
}
