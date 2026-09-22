import { get } from './http.js';
import { CONFIG } from '../config.js';
import { classify } from '../models.js';

// Best Buy blocks non-browser clients on www.bestbuy.com, so this uses their
// official free Developer API instead. Without a key the source reports
// "skipped" rather than failing, so it never trips the health alarm.
const BASE = 'https://api.bestbuy.com/v1';

export const id = 'bestbuy';
export const label = 'Best Buy';
export const minIntervalSeconds = 60;


export async function check({ deep = true } = {}) {
  const apiKey = process.env.BESTBUY_API_KEY;
  if (!apiKey) return { skipped: 'BESTBUY_API_KEY not set' };

  const show =
    'sku,name,salePrice,regularPrice,onlineAvailability,inStoreAvailability,url,addToCartUrl,marketplace,condition';
  const searchUrl =
    `${BASE}/products(search=playstation&search=5&search=pro&type=HardGood)` +
    `?format=json&pageSize=25&show=${show}&apiKey=${apiKey}`;

  const data = await get(searchUrl, { json: true });
  // Best Buy lists marketplace resellers next to its own stock, often far
  // above MSRP. Only Best Buy's own offer is ever alerted on.
  const products = (data?.products ?? []).filter((p) => {
    if (!classify(p.name)) return false;
    if (p.condition && !/new/i.test(p.condition)) return false;
    if (p.marketplace === true) return false;
    const seller = p.sellerName ?? p.soldBy ?? '';
    if (seller && !/^best\s*buy$/i.test(seller.trim())) return false;
    return true;
  });
  if (products.length === 0) return [];

  const offers = [];
  for (const p of products) {
    const price = p.salePrice ?? p.regularPrice ?? null;
    const model = classify(p.name);
    offers.push({
      key: `bestbuy:ship:${p.sku}`,
      channel: 'Ship to address',
      inStock: p.onlineAvailability === true,
      price,
      model,
      url: p.addToCartUrl || p.url,
      note: p.name,
    });

    // Only spend a second call on store stock for a product priced sanely.
    // The docs are explicit: inStoreAvailability only says the product is
    // sold in stores, not that any store has it. Per-store truth comes from
    // the stores endpoint, so ask it whenever the price qualifies.
    if (deep && price != null && model && price <= model.maxPrice) {
      try {
        const stores = await get(
          `${BASE}/products/${p.sku}/stores.json?postalCode=${CONFIG.zip}` +
            `&storeDistance=25&apiKey=${apiKey}`,
          { json: true }
        );
        for (const s of (stores?.stores ?? []).slice(0, 4)) {
          offers.push({
            key: `bestbuy:store:${p.sku}:${s.storeID}`,
            channel: `Store pickup — ${s.name ?? s.city}`,
            inStock: true,
            price,
            model,
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
