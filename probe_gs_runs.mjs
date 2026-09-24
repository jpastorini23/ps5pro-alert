import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://www.gamestop.com/consoles-hardware/playstation-5/consoles/products/sony-playstation-5-pro-console/20015604.html';

async function once(tag) {
  let b;
  try {
    b = await chromium.launch({ channel: 'chrome', headless: false });
    const ctx = await b.newContext({ locale:'en-US', timezoneId:'America/Los_Angeles', viewport:{width:1400,height:1000} });
    const page = await ctx.newPage();
    const resp = await page.goto(URL, { waitUntil:'domcontentloaded', timeout:60000 });
    const status = resp ? resp.status() : null;
    await page.waitForTimeout(6000);
    const title = await page.title();
    const r = await page.evaluate(() => {
      const out = [];
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { out.push(JSON.parse(s.textContent)); } catch(e) {}
      }
      const flat = []; const walk = n => { if (Array.isArray(n)) n.forEach(walk); else if (n&&typeof n==='object'){flat.push(n); if(n['@graph'])walk(n['@graph']);} }; walk(out);
      const p = flat.find(n => n['@type']==='Product');
      const offers = p ? (Array.isArray(p.offers)?p.offers:[p.offers]).map(o=>({sku:o.sku,name:o.name,price:o.price,cond:(o.itemCondition||'').split('/').pop(),avail:(o.availability||'').split('/').pop(),seller:o.seller&&o.seller.name})) : null;
      const g = document.querySelector('.product-availability.global-availability');
      const ship = document.querySelector('.js-fulfilment-option-ship');
      const store = document.querySelector('.js-fulfilment-option-store');
      const atc = document.querySelector('.add-to-cart');
      return {
        productName: p ? p.name : null, offers,
        dom: {
          gFound: !!g, dataAvailable: g?g.getAttribute('data-available'):null, dataReady: g?g.getAttribute('data-ready-to-order'):null,
          gText: g?(g.innerText||'').trim().slice(0,160):null,
          shipFound: !!ship, shipUnavail: ship?ship.classList.contains('unavailable'):null, shipText: ship?(ship.innerText||'').trim().replace(/\s+/g,' ').slice(0,100):null,
          storeFound: !!store, storeUnavail: store?store.classList.contains('unavailable'):null, storeText: store?(store.innerText||'').trim().replace(/\s+/g,' ').slice(0,100):null,
          atcText: atc?(atc.innerText||'').trim():null, atcDisabled: atc?!!atc.disabled:null,
          challenge: /just a moment|verify you are human|checking your browser|Attention Required|Sorry, you have been blocked/i.test(document.body.innerText),
          bodyLen: document.body.innerText.length
        }
      };
    });
    await b.close();
    return { tag, ok:true, at:new Date().toISOString(), status, title, ...r };
  } catch (e) {
    try { if (b) await b.close(); } catch(_){}
    return { tag, ok:false, at:new Date().toISOString(), error: String(e).split('\n')[0] };
  }
}

const results = [];
for (let i=1;i<=4;i++) {
  const r = await once('run'+i);
  results.push(r);
  console.log('--- run'+i+' ---');
  console.log(JSON.stringify(r, null, 1));
  await new Promise(s=>setTimeout(s, 8000));
}
fs.writeFileSync('/private/tmp/claude-501/-Users-juancruzpastorini-Desktop-Claude/fb6c2655-93e9-4052-9642-00c8aeda3a33/scratchpad/gs_runs.json', JSON.stringify(results,null,2));
