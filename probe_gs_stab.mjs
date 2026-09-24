import { chromium } from 'playwright';
const URL='https://www.gamestop.com/consoles-hardware/playstation-5/consoles/products/sony-playstation-5-pro-console/416188.html';
const res=[];
for(let i=1;i<=5;i++){
  let b;
  try{
    b=await chromium.launch({channel:'chrome',headless:false});
    const ctx=await b.newContext({locale:'en-US',timezoneId:'America/Los_Angeles',viewport:{width:1400,height:1000}});
    const page=await ctx.newPage();
    const r=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(7000);
    const o=await page.evaluate(()=>{
      const arr=[];for(const s of document.querySelectorAll('script[type="application/ld+json"]')){try{arr.push(JSON.parse(s.textContent))}catch(e){}}
      const flat=[];const w=n=>{if(Array.isArray(n))n.forEach(w);else if(n&&typeof n==='object'){flat.push(n);if(n['@graph'])w(n['@graph'])}};w(arr);
      const p=flat.find(n=>n['@type']==='Product');
      const offs=p?(Array.isArray(p.offers)?p.offers:[p.offers]):[];
      const nw=offs.filter(o=>o.itemCondition==='https://schema.org/NewCondition');
      const g=document.querySelector('.product-availability.global-availability');
      const atc=document.querySelector('.add-to-cart');
      return { n:offs.length, newCount:nw.length,
        newAvail:nw[0]?nw[0].availability.split('/').pop():null, newSku:nw[0]?nw[0].sku:null, newSeller:nw[0]&&nw[0].seller?nw[0].seller.name:null, newPrice:nw[0]?nw[0].price:null,
        gAvail:g?g.getAttribute('data-available'):null, gReady:g?g.getAttribute('data-ready-to-order'):null,
        atc:atc?(atc.innerText||'').trim():null, dis:atc?!!atc.disabled:null,
        blocked:/Sorry, you have been blocked/i.test(document.body.innerText) };
    });
    res.push({i, http:r.status(), ...o});
    console.log('run'+i, JSON.stringify(res[res.length-1]));
  }catch(e){ res.push({i,err:String(e).split('\n')[0]}); console.log('run'+i,'ERROR',String(e).split('\n')[0]); }
  try{if(b)await b.close()}catch(_){}
  await new Promise(s=>setTimeout(s,7000));
}
const ok=res.filter(r=>!r.err);
console.log('\nSUMMARY: ok='+ok.length+'/'+res.length,
 '| newAvail set:', JSON.stringify([...new Set(ok.map(r=>r.newAvail))]),
 '| atc set:', JSON.stringify([...new Set(ok.map(r=>r.atc))]),
 '| gAvail set:', JSON.stringify([...new Set(ok.map(r=>r.gAvail))]));
