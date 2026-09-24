import { chromium } from 'playwright';

const URL = 'https://www.gamestop.com/consoles-hardware/playstation-5/consoles/products/sony-playstation-5-pro-console/20015604.html';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({
  locale: 'en-US',
  timezoneId: 'America/Los_Angeles',
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();

const xhr = [];
page.on('response', r => {
  const u = r.url();
  if (/gamestop\.com/.test(u) && /(json|Product-|Stores-|availability|inventory|\/api\/)/i.test(u)) {
    xhr.push(r.status() + ' ' + u.slice(0, 180));
  }
});

let status = 'n/a';
try {
  const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  status = resp ? resp.status() : 'null';
} catch (e) {
  console.log('NAV ERROR', e.message);
}
await page.waitForTimeout(6000);

const title = await page.title();
const html = await page.content();
console.log('HTTP status:', status);
console.log('title:', title);
console.log('html length:', html.length);
console.log('challenge markers:', JSON.stringify({
  cfChallenge: /challenge-platform|cf-challenge|Just a moment|Attention Required|Sorry, you have been blocked/i.test(html),
  cfRay: /cf-ray/i.test(html),
}));

// schema.org / JSON-LD
const ld = await page.$$eval('script[type="application/ld+json"]', ns => ns.map(n => n.textContent.slice(0, 4000)));
console.log('--- JSONLD count:', ld.length);
ld.forEach((t, i) => console.log('LD[' + i + ']:', t.replace(/\s+/g, ' ').slice(0, 1200)));

// availability meta / microdata
const avail = await page.evaluate(() => {
  const out = {};
  document.querySelectorAll('[itemprop="availability"], meta[property*="availability"]').forEach((e, i) => {
    out['microdata_' + i] = (e.getAttribute('href') || e.getAttribute('content') || e.textContent || '').trim();
  });
  const btn = document.querySelector('button.add-to-cart, .add-to-cart, [data-pid] button');
  if (btn) out.atcText = btn.textContent.trim().slice(0, 80) + ' | disabled=' + btn.disabled;
  const dp = document.querySelector('.product-detail, [data-pid]');
  if (dp) out.dataPid = dp.getAttribute('data-pid');
  const g = document.querySelector('.availability-msg, .product-availability, .availability');
  if (g) out.availMsg = g.textContent.replace(/\s+/g, ' ').trim().slice(0, 200);
  const price = document.querySelector('.actual-price, .sales .value, [itemprop="price"]');
  if (price) out.price = (price.getAttribute('content') || price.textContent).trim().slice(0, 40);
  return out;
});
console.log('--- DOM signals:', JSON.stringify(avail, null, 1));
console.log('--- XHR seen:'); xhr.slice(0, 40).forEach(x => console.log('   ', x));

await browser.close();
