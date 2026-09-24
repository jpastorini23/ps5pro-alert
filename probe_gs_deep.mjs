import { chromium } from 'playwright';
import fs from 'fs';
const URL = 'https://www.gamestop.com/consoles-hardware/playstation-5/consoles/products/sony-playstation-5-pro-console/20015604.html';
const b = await chromium.launch({ channel:'chrome', headless:false });
const ctx = await b.newContext({ locale:'en-US', timezoneId:'America/Los_Angeles', viewport:{width:1400,height:1000} });
const page = await ctx.newPage();
const resp = await page.goto(URL, { waitUntil:'domcontentloaded', timeout:60000 });
const headers = resp.headers();
const rawHtml = await resp.text();
fs.writeFileSync('/private/tmp/claude-501/-Users-juancruzpastorini-Desktop-Claude/fb6c2655-93e9-4052-9642-00c8aeda3a33/scratchpad/gs_raw.html', rawHtml);

// Is the availability present in the RAW server HTML (pre-JS)?
const rawHasLd = /application\/ld\+json/.test(rawHtml);
const rawNewOffer = rawHtml.match(/"sku"\s*:\s*"416188"[\s\S]{0,600}?"availability"\s*:\s*"([^"]+)"/);
const rawAvailAny = [...rawHtml.matchAll(/"availability"\s*:\s*"([^"]+)"/g)].map(m=>m[1]);

// sample the DOM state over time to characterise the hydration race
const samples = [];
for (const t of [0, 1000, 2000, 3000, 4000, 6000, 9000, 13000, 18000]) {
  if (t>0) await page.waitForTimeout(t - (samples.length? samples[samples.length-1].t:0));
  const s = await page.evaluate(() => {
    const g=document.querySelector('.product-availability.global-availability');
    const atc=document.querySelector('.add-to-cart');
    return { avail:g?g.getAttribute('data-available'):null, ready:g?g.getAttribute('data-ready-to-order'):null,
             atc:atc?(atc.innerText||'').trim():null, dis:atc?!!atc.disabled:null,
             gTxt:g?(g.innerText||'').trim().replace(/\s+/g,' '):null };
  });
  samples.push({t, ...s});
}
const bodyText = await page.evaluate(()=>document.body.innerText);
fs.writeFileSync('/private/tmp/claude-501/-Users-juancruzpastorini-Desktop-Claude/fb6c2655-93e9-4052-9642-00c8aeda3a33/scratchpad/gs_body.txt', bodyText);

console.log(JSON.stringify({
  cacheHeaders: { 'cf-cache-status':headers['cf-cache-status'], age:headers['age'], 'cache-control':headers['cache-control'], server:headers['server'], date:headers['date'], 'x-cache':headers['x-cache'], vary:headers['vary'] },
  rawHasLd, rawNewOfferAvailability: rawNewOffer?rawNewOffer[1]:null, rawAvailAll: rawAvailAny,
  samples
}, null, 2));
await b.close();
