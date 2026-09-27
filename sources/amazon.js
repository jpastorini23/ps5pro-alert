import { get } from './http.js';
import { classify } from '../models.js';

// Amazon serves this page to a plain request without a bot challenge, and the
// buybox state is in the raw HTML — no browser needed.
const ASIN = 'B0DSLVJ994'; // PlayStation 5 Pro, 2TB
const URL = `https://www.amazon.com/dp/${ASIN}`;

// Amazon's standard out-of-stock buybox copy. Kept short on purpose: the
// full sentence is broken up by </span> and <br/> in the markup, so matching
// the whole phrase silently fails.
const UNAVAILABLE = /Currently unavailable/i;

export const id = 'amazon';
export const label = 'Amazon';
export const minIntervalSeconds = 60;

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export async function check(_opts = {}) {
  const html = await get(URL);

  const titleMatch = html.match(/id="productTitle"[^>]*>(.*?)<\/span>/s);
  const title = titleMatch ? strip(titleMatch[1]) : 'PlayStation 5 Pro';
  const model = classify(title);
  if (!model) return [];

  const unavailable = UNAVAILABLE.test(html);

  // Price must come from the buybox, not from anywhere on the page. The
  // first a-offscreen on this page belonged to a recommended product, which
  // read $598 for a $899 console — scoping prevents alerting on the wrong item.
  const buybox =
    (html.match(/id="corePrice[^"]*"[\s\S]{0,2500}/) || [])[0] ||
    (html.match(/id="apex_desktop"[\s\S]{0,2500}/) || [])[0] ||
    (html.match(/id="buybox"[\s\S]{0,4000}/) || [])[0] ||
    '';
  const priceMatch =
    buybox.match(/"priceAmount":\s*([\d.]+)/) ||
    buybox.match(/class="a-offscreen">\$([\d,]+\.\d\d)/);
  const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null;

  // Only Amazon's own offer counts; marketplace resellers sit far above MSRP.
  const soldByAmazon =
    /Ships from[^<]{0,40}Amazon/i.test(strip(html)) ||
    /Sold by[^<]{0,40}Amazon\.com/i.test(strip(html));

  const inStock = !unavailable && price != null && soldByAmazon;

  if (!unavailable && price == null) {
    console.log('  ! Amazon looks available but no price parsed — parser needs a look');
  }

  return [
    {
      key: `amazon:${ASIN}`,
      channel: 'Ship to a US address',
      inStock,
      price,
      model,
      url: URL,
      note: title.slice(0, 60),
    },
  ];
}
