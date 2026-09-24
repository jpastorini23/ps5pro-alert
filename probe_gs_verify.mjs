import { chromium } from 'playwright';

const URL = 'https://www.gamestop.com/consoles-hardware/playstation-5/consoles/products/sony-playstation-5-pro-console/20015604.html';

const b = await chromium.launch({ channel: 'chrome', headless: false });
const ctx = await b.newContext({ locale:'en-US', timezoneId:'America/Los_Angeles', viewport:{width:1400,height:1000} });
const page = await ctx.newPage();

let status = null, finalUrl = null;
page.on('response', r => { if (r.url() === URL || r.url().startsWith(URL)) status = r.status(); });

const resp = await page.goto(URL, { waitUntil:'domcontentloaded', timeout:60000 });
if (resp) status = resp.status();
await page.waitForTimeout(6000);
finalUrl = page.url();

const title = await page.title();
const readAt = new Date().toISOString();

// 1. JSON-LD
const ld = await page.evaluate(() => {
  const out = [];
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { out.push(JSON.parse(s.textContent)); } catch(e) { out.push({__parse_error: String(e), raw: s.textContent.slice(0,300)}); }
  }
  return out;
});

const flat = [];
const walk = n => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n==='object') { flat.push(n); if (n['@graph']) walk(n['@graph']); } };
walk(ld);
const products = flat.filter(n => n['@type'] === 'Product' || (Array.isArray(n['@type']) && n['@type'].includes('Product')));

// 2. DOM corroboration
const dom = await page.evaluate(() => {
  const g = document.querySelector('.product-availability.global-availability');
  const ship = document.querySelector('.js-fulfilment-option-ship');
  const store = document.querySelector('.js-fulfilment-option-store');
  const atc = document.querySelector('button.add-to-cart, .add-to-cart, [data-pid] button.add-to-cart');
  const btns = [...document.querySelectorAll('button')].map(b=>({t:(b.innerText||'').trim().slice(0,40), dis:b.disabled, cls:b.className.slice(0,80)})).filter(x=>x.t);
  return {
    globalAvailFound: !!g,
    dataAvailable: g ? g.getAttribute('data-available') : null,
    dataReadyToOrder: g ? g.getAttribute('data-ready-to-order') : null,
    globalText: g ? (g.innerText||'').trim().slice(0,200) : null,
    shipFound: !!ship,
    shipUnavailable: ship ? ship.classList.contains('unavailable') : null,
    shipText: ship ? (ship.innerText||'').trim().slice(0,120) : null,
    storeFound: !!store,
    storeUnavailable: store ? store.classList.contains('unavailable') : null,
    storeText: store ? (store.innerText||'').trim().slice(0,120) : null,
    atcText: atc ? (atc.innerText||'').trim() : null,
    atcDisabled: atc ? atc.disabled : null,
    buttons: btns.slice(0,25),
    h1: (document.querySelector('h1')?.innerText||'').trim(),
    bodyLen: document.body.innerText.length,
    cfChallenge: /just a moment|verify you are human|cf-challenge|checking your browser|Attention Required/i.test(document.body.innerText)
  };
});

console.log(JSON.stringify({ readAt, status, finalUrl, title, ldCount: ld.length, productCount: products.length, products, dom }, null, 2));

await b.close();
