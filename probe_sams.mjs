import { chromium } from 'playwright';

const URLS = [
  'https://www.samsclub.com/ip/playstation-5-pro-console/13940750257',
  'https://www.samsclub.com/ip/playstation-5-pro-console-2-tb/18717057017',
];

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const apiCalls = [];
page.on('response', async (r) => {
  const u = r.url();
  if (/\/api\/|graphql|\.json/.test(u) && !/\.(png|jpg|svg|woff|css|js)(\?|$)/.test(u)) {
    apiCalls.push(`${r.status()} ${u.slice(0, 160)}`);
  }
});

for (const url of URLS) {
  console.log('\n===== ' + url);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(6000);
    const info = await page.evaluate(() => {
      const out = { url: location.href, title: document.title };
      // schema.org JSON-LD
      out.ld = [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map(s => s.textContent.slice(0, 1200));
      // any availability meta
      out.metaAvail = [...document.querySelectorAll('[itemprop="availability"], meta[property*="availability"]')]
        .map(e => e.getAttribute('href') || e.getAttribute('content') || e.textContent);
      // next.js / preloaded state blobs
      out.blobs = [...document.querySelectorAll('script[id],script[type="application/json"]')]
        .map(s => ({ id: s.id, type: s.type, len: (s.textContent||'').length }))
        .filter(b => b.len > 200);
      out.bodySnippet = (document.body.innerText || '').slice(0, 900);
      return out;
    });
    console.log(JSON.stringify(info, null, 2).slice(0, 4000));
  } catch (e) {
    console.log('ERR ' + e.message);
  }
}

console.log('\n===== API-ish responses seen:');
console.log([...new Set(apiCalls)].join('\n').slice(0, 4000));

await browser.close();
