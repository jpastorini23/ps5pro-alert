import { get } from './http.js';
import { CONFIG } from '../config.js';

// Target's public store API. Key is the one target.com ships to the browser.
const KEY = '9f36aeafbe60771e321a7cc95a78140772ab3e96';

// Any PS5 Pro console or bundle counts. Accessories do not.
const KEYWORDS = ['playstation 5 pro console', 'ps5 pro bundle'];
const MATCH = /5\s*pro/i;
const EXCLUDE = /(controller|cover|headset|game|stand|case|remote|charging|skin|faceplate)/i;

export const id = 'target';
export const label = 'Target';

let cachedProducts = null; // Rediscovered on every deep cycle.

function searchUrl(keyword) {
  const q = new URLSearchParams({
    key: KEY,
    channel: 'WEB',
    count: '24',
    default_purchasability_filter: 'false',
    keyword,
    offset: '0',
    page: `/s/${keyword}`,
    platform: 'desktop',
    pricing_store_id: CONFIG.targetStores[0].id,
    visitor_id: '0192ABCDEF000000',
  });
  return `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?${q}`;
}

function fulfillmentUrl(tcin, storeId) {
  const q = new URLSearchParams({
    key: KEY,
    tcins: tcin,
    store_id: storeId,
    zip: CONFIG.zip,
    state: 'CA',
    latitude: String(CONFIG.lat),
    longitude: String(CONFIG.lon),
    channel: 'WEB',
    page: `/p/A-${tcin}`,
    pricing_store_id: storeId,
    has_pricing_store_id: 'true',
    scheduled_delivery_store_id: storeId,
    required_store_id: storeId,
    has_required_store_id: 'true',
    visitor_id: '0192ABCDEF000000',
    is_bot: 'false',
  });
  return `https://redsky.target.com/redsky_aggregations/v1/web/product_summary_with_fulfillment_v1?${q}`;
}

// Finds every PS5 Pro console/bundle Target lists, so a new bundle is picked
// up automatically instead of needing a hardcoded SKU.
async function discover() {
  const found = new Map();
  for (const keyword of KEYWORDS) {
    let data;
    try {
      data = await get(searchUrl(keyword), { json: true });
    } catch {
      continue; // One dead keyword must not lose the others.
    }
    for (const p of data?.data?.search?.products ?? []) {
      const title = (p.item?.product_description?.title ?? '')
        .replace(/&#\d+;|®|™/g, '')
        .trim();
      if (!MATCH.test(title) || EXCLUDE.test(title)) continue;
      found.set(p.tcin, title);
    }
  }
  if (found.size === 0) throw new Error('no PS5 Pro listing found in search');
  return [...found].map(([tcin, title]) => ({ tcin, title }));
}

export async function check({ deep = true } = {}) {
  if (deep || !cachedProducts) cachedProducts = await discover();

  const offers = [];
  for (const { tcin, title } of cachedProducts) {
    const pdp = `https://www.target.com/p/-/A-${tcin}`;
    const stores = deep ? CONFIG.targetStores : CONFIG.targetStores.slice(0, 1);
    let price = null;

    for (const [i, store] of stores.entries()) {
      const data = await get(fulfillmentUrl(tcin, store.id), { json: true });
      const summary = data?.data?.product_summaries?.[0];
      if (!summary) throw new Error(`unexpected payload for ${tcin}`);

      price = summary.price?.current_retail ?? price;
      const f = summary.fulfillment ?? {};

      // Shipping is store-independent — record it once per product.
      if (i === 0) {
        offers.push({
          key: `target:${tcin}:ship`,
          channel: 'Ship to a US address',
          inStock: f.shipping_options?.availability_status === 'IN_STOCK',
          price,
          url: pdp,
          note: title,
        });
      }
      if (!deep) break;

      const opt = (f.store_options ?? []).find((s) => s.location_id === store.id);
      const qty = opt?.location_available_to_promise_quantity ?? 0;
      offers.push({
        key: `target:${tcin}:store:${store.id}`,
        channel: `Pick up in SF — ${store.name}`,
        inStock: opt?.order_pickup?.availability_status === 'IN_STOCK',
        price,
        url: pdp,
        note: `${title} · ${store.address}${qty ? ` · ${qty} in store` : ''}`,
      });
    }
  }
  return offers;
}
