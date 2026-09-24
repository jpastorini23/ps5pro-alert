import { chromium } from 'playwright';
const targets = [
  ['DUALSENSE','https://www.gamestop.com/gaming-accessories/controllers/products/playstation-5-dualsense-wireless-controller-midnight-black/11110665.html'],
  ['PS5PRO_NEW_SKU','https://www.gamestop.com/consoles-hardware/playstation-5/consoles/products/sony-playstation-5-pro-console/416188.html'],
  ['PS5PRO_DISC','https://www.gamestop.com/consoles-hardware/playstation-5/consoles/products/sony-playstation-5-pro-console-with-disc-drive/20015772.html'],
];
for (const [tag,url] of targets) {
  let b;
  try{
    b=await chromium.launch({channel:'chrome',headless:false});
    const ctx=await b.newContext({locale:'en-US',timezoneId:'America/Los_Angeles',viewport:{width:1400,height:1000}});
    const page=await ctx.newPage();
    const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(7000);
    const out=await page.evaluate(()=>{
      const arr=[];for(const s of document.querySelectorAll('script[type="application/ld+json"]')){try{arr.push(JSON.parse(s.textContent))}catch(e){}}
      const flat=[];const w=n=>{if(Array.isArray(n))n.forEach(w);else if(n&&typeof n==='object'){flat.push(n);if(n['@graph'])w(n['@graph'])}};w(arr);
      const p=flat.find(n=>n['@type']==='Product');
      const g=document.querySelector('.product-availability.global-availability');
      const atc=document.querySelector('.add-to-cart');
      return { name:p?p.name:null,
        offers:p?(Array.isArray(p.offers)?p.offers:[p.offers]).map(o=>({sku:o.sku,nm:o.name,pr:o.price,cond:(o.itemCondition||'').split('/').pop(),av:(o.availability||'').split('/').pop(),sel:o.seller&&o.seller.name})):null,
        gAvail:g?g.getAttribute('data-available'):null, atc:atc?(atc.innerText||'').trim():null, dis:atc?!!atc.disabled:null,
        blocked:/Sorry, you have been blocked/i.test(document.body.innerText), t:document.title };
    });
    console.log(tag,'| HTTP', r?r.status():'?','| title:', out.t);
    console.log('  name:', out.name);
    for(const o of (out.offers||[])) console.log('   ', o.sku, o.nm, '$'+o.pr, o.cond, '->', o.av, 'seller='+o.sel);
    console.log('   DOM data-available=', out.gAvail,' atc=',JSON.stringify(out.atc),' disabled=',out.dis);
  }catch(e){ console.log(tag,'ERROR',String(e).split('\n')[0]); }
  try{ if(b) await b.close(); }catch(_){}
  await new Promise(s=>setTimeout(s,10000));
}
