import { chromium } from 'playwright';
const URL = process.argv[2] || 'https://www.samsclub.com/ip/playstation-5-pro-console/13940750257';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const api = [];
page.on('response', async r => {
  const u = r.url();
  if (!/samsclub\.com/.test(u)) return;
  if (!/(api|inventory|availability|fulfillment|item)/i.test(u)) return;
  const ct = r.headers()['content-type'] || '';
  if (!/json/.test(ct)) return;
  let body = null;
  try { body = (await r.text()).slice(0, 400); } catch {}
  api.push({ status: r.status(), url: u.slice(0, 190), body });
});
try { await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch {}
await page.waitForTimeout(8000);
const out = await page.evaluate(() => {
  const t = document.body ? document.body.innerText : '';
  const lds = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map(s => { try { return JSON.parse(s.textContent); } catch { return null; } }).filter(Boolean);
  const p = lds.find(x => x && x['@type'] === 'Product');
  const idx = t.indexOf('How do you want your item');
  const keys = Object.keys(window).filter(k => /__|PRELOADED|INITIAL|apollo/i.test(k)).slice(0, 15);
  return {
    ts: new Date().toISOString(),
    href: location.href,
    title: document.title,
    blockedGuard: /are-you-human/.test(location.href),
    availability: p?.offers?.[0]?.availability ?? null,
    seller: p?.offers?.[0]?.seller ?? p?.offers?.[0]?.offeredBy ?? null,
    fulfil: idx >= 0 ? t.slice(idx, idx + 300).replace(/\n+/g, ' / ') : null,
    clubLine: (t.match(/[A-Za-z .'-]+,\s*\d{5}[^\n]{0,25}/) || [])[0] || null,
    soldBy: (t.match(/[Ss]old (and shipped )?by[^\n]{0,50}/g) || []),
    globals: keys,
  };
});
out.api = api.slice(0, 12);
console.log(JSON.stringify(out, null, 1));
await browser.close();
