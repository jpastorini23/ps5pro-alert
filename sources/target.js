import { get } from './http.js';
import { CONFIG } from '../config.js';

// Target's public store API. Key is the one target.com itself ships to the browser.
const KEY = '9f36aeafbe60771e321a7cc95a78140772ab3e96';
const TCIN = '93620188'; // PlayStation 5 Pro Console
const PDP = `https://www.target.com/p/playstation-5-pro-console/-/A-${TCIN}`;

function endpoint(storeId) {
  const q = new URLSearchParams({
    key: KEY,
    tcins: TCIN,
    store_id: storeId,
    zip: CONFIG.zip,
    state: 'CA',
    latitude: String(CONFIG.lat),
    longitude: String(CONFIG.lon),
    channel: 'WEB',
    page: `/p/A-${TCIN}`,
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

export const id = 'target';
export const label = 'Target';

// deep=false checks only online shipping (1 request). deep=true also walks
// the three SF stores. The fast loop stays light; stores are polled less often.
export async function check({ deep = true } = {}) {
  const offers = [];
  let price = null;
  let shippingDone = false;

  const stores = deep ? CONFIG.targetStores : CONFIG.targetStores.slice(0, 1);
  for (const store of stores) {
    const data = await get(endpoint(store.id), { json: true });
    const summary = data?.data?.product_summaries?.[0];
    if (!summary) throw new Error('unexpected payload: no product_summaries');

    price = summary.price?.current_retail ?? price;
    const f = summary.fulfillment ?? {};

    // Online shipping is store-independent — record it once.
    if (!shippingDone) {
      shippingDone = true;
      offers.push({
        key: 'target:ship',
        channel: 'Ship to address',
        inStock: f.shipping_options?.availability_status === 'IN_STOCK',
        price,
        url: PDP,
      });
    }

    if (!deep) break;

    const opt = (f.store_options ?? []).find((s) => s.location_id === store.id);
    const pickup = opt?.order_pickup?.availability_status;
    const qty = opt?.location_available_to_promise_quantity ?? 0;
    offers.push({
      key: `target:store:${store.id}`,
      channel: `Store pickup — ${store.name}`,
      inStock: pickup === 'IN_STOCK',
      price,
      url: PDP,
      note: `${store.address}${qty ? ` · ${qty} in store` : ''}`,
    });
  }

  return offers;
}
