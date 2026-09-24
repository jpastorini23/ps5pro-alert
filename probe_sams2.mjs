import { chromium } from 'playwright';
const URL = 'https://www.samsclub.com/ip/playstation-5-pro-console/13940750257';

async function run(tag, ctxOpts = {}) {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...ctxOpts });
  const page = await ctx.newPage();
  const t0 = Date.now();
  let res = null;
  try { res = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch (e) { }
  await page.waitForTimeout(6000);
  const out = await page.evaluate(() => {
    const t = document.body ? document.body.innerText : '';
    const lds = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map(s => { try { return JSON.parse(s.textContent); } catch { return null; } }).filter(Boolean);
    const p = lds.find(x => x && x['@type'] === 'Product');
    const idx = t.indexOf('How do you want your item');
    const grab = (re) => { const m = t.match(re); return m ? m[0] : null; };
    return {
      url: location.href,
      blockedGuard: /are-you-human/.test(location.href),
      availability: p?.offers?.[0]?.availability ?? null,
      prices: p?.offers?.[0]?.priceSpecification?.map(x => [x.price, x.validForMemberTier?.['@id'] ?? 'nonmember']) ?? null,
      delivery: p?.offers?.[0]?.availableDeliveryMethod ?? null,
      fulfil: idx >= 0 ? t.slice(idx, idx + 260).replace(/\n+/g, ' / ') : null,
      club: grab(/[A-Za-z .'-]+,\s*\d{5}\s*Change address/) || grab(/Change address/),
      itemNum: grab(/Item #\s*\d+/),
      priceLine: grab(/Current price is \$[\d.,]+/),
      soldBy: (t.match(/[Ss]old (and shipped )?by[^\n]{0,50}/g) || []),
      market: /marketplace|Sold by .* on samsclub/i.test(t),
      addToCart: !!t.match(/Add to cart/i),
      notify: !!t.match(/notify me|email me when|back in stock/i),
      textLen: t.length,
    };
  });
  out.tag = tag; out.httpStatus = res ? res.status() : null; out.ms = Date.now() - t0;
  console.log(JSON.stringify(out));
  await browser.close();
}
await run('coldA');
await run('coldB-immediate-repeat');
