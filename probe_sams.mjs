import { chromium } from 'playwright';

const URL = 'https://www.samsclub.com/ip/playstation-5-pro-console/13940750257';

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const t0 = Date.now();
let status = null;
page.on('response', r => { if (r.url() === URL || r.url().startsWith(URL)) status = r.status(); });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(6000);

const out = await page.evaluate(() => {
  const blocked = /are-you-human|blocked|captcha/i.test(location.href);
  const lds = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map(s => { try { return JSON.parse(s.textContent); } catch { return null; } })
    .filter(Boolean);
  const types = lds.map(x => Array.isArray(x) ? x.map(y=>y['@type']) : x['@type']);
  const p = lds.find(x => x && x['@type'] === 'Product');
  const txt = document.body ? document.body.innerText : '';
  const i = txt.indexOf('How do you want your item');
  return {
    url: location.href,
    blocked,
    title: document.title,
    ldCount: lds.length,
    ldTypes: types,
    product: p || null,
    availability: p?.offers?.[0]?.availability ?? p?.offers?.availability ?? null,
    fulfilSnippet: i >= 0 ? txt.slice(i, i + 320) : null,
    textLen: txt.length,
    textHead: txt.slice(0, 900),
    sellerHits: txt.match(/sold\s+(and shipped\s+)?by[^\n]{0,60}/gi) || [],
  };
});
out.httpStatus = status;
out.elapsedMs = Date.now() - t0;
console.log(JSON.stringify(out, null, 2));
await browser.close();
