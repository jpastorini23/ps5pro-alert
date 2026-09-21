import { get } from './http.js';
import { CONFIG } from '../config.js';

// Best Buy blocks non-browser clients on www.bestbuy.com, so this uses their
// official free Developer API instead. Without a key the source reports
// "skipped" rather than failing, so it never trips the health alarm.
const BASE = 'https://api.bestbuy.com/v1';

export const id = 'bestbuy';
export const label = 'Best Buy';
export const minIntervalSeconds = 60;

// Matches the console itself, not controllers, games or accessories.
const NAME_RE = /playstation\W*5\W*pro/i;
const EXCLUDE_RE = /(controller|headset|cover|game|remote|stand|charging|bundle case|skin)/i;

export async function check({ deep = true } = {}) {
  const apiKey = process.env.BESTBUY_API_KEY;
  if (!apiKey) return { skipped: 'BESTBUY_API_KEY not set' };

  const show = 'sku,name,salePrice,regularPrice,onlineAvailability,inStoreAvailability,url,addToCartUrl';
  const searchUrl =
    `${BASE}/products(search=playstation&search=5&search=pro&type=HardGood)` +
    `?format=json&pageSize=25&show=${show}&apiKey=${apiKey}`;

  const data = await get(searchUrl, { json: true });
  const products = (data?.products ?? []).filter(
    (p) => NAME_RE.test(p.name ?? '') && !EXCLUDE_RE.test(p.name ?? '')
  );
  if (products.length === 0) return [];

  const offers = [];
  for (const p of products) {
    const price = p.salePrice ?? p.regularPrice ?? null;
    offers.push({
      key: `bestbuy:ship:${p.sku}`,
      channel: 'Ship to address',
      inStock: p.onlineAvailability === true,
      price,
      url: p.addToCartUrl || p.url,
      note: p.name,
    });

    // Only spend a second call on store stock for a product priced sanely.
    if (deep && price != null && price <= CONFIG.maxPrice && p.inStoreAvailability === true) {
      try {
        const stores = await get(
          `${BASE}/products/${p.sku}/stores.json?postalCode=${CONFIG.zip}` +
            `&storeDistance=25&apiKey=${apiKey}`,
          { json: true }
        );
        for (const s of (stores?.stores ?? []).slice(0, 4)) {
          offers.push({
            key: `bestbuy:store:${p.sku}:${s.storeId}`,
            channel: `Store pickup — ${s.name ?? s.city}`,
            inStock: true,
            price,
            url: p.url,
            note: `${s.address ?? ''} ${s.city ?? ''}`.trim(),
          });
        }
      } catch {
        // Store lookup is a bonus; a failure here must not lose the online signal.
      }
    }
  }
  return offers;
}
