import { chromium } from 'playwright';
const URL = 'https://www.samsclub.com/ip/playstation-5-pro-console/13940750257';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
try { await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch {}
await page.waitForTimeout(7000);
const out = await page.evaluate(() => {
  const t = document.body ? document.body.innerText : '';
  const lds = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map(s => { try { return JSON.parse(s.textContent); } catch { return null; } }).filter(Boolean);
  const p = lds.find(x => x && x['@type'] === 'Product');
  const idx = t.indexOf('How do you want your item');
  return {
    ts: new Date().toISOString(),
    url: location.href,
    blockedGuard: /are-you-human/.test(location.href),
    availability: p?.offers?.[0]?.availability ?? null,
    prices: p?.offers?.[0]?.priceSpecification?.map(x => [x.price, x.validForMemberTier?.['@id'] ?? 'nonmember']) ?? null,
    delivery: p?.offers?.[0]?.availableDeliveryMethod ?? null,
    fulfil: idx >= 0 ? t.slice(idx, idx + 300).replace(/\n+/g, ' / ') : null,
    club: (t.match(/[A-Za-z .'-]+,\s*\d{5}[^\n]{0,20}/) || [])[0] || null,
    soldBy: (t.match(/[Ss]old (and shipped )?by[^\n]{0,50}/g) || []),
    priceLines: (t.match(/(Current price is|Member price|Non-member|Plus)[^\n]{0,60}/g) || []).slice(0,8),
    head: t.slice(0, 700).replace(/\n+/g, ' / '),
    textLen: t.length,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
