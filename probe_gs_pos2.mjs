import { chromium } from 'playwright';
const url='https://www.gamestop.com/gaming-accessories/controllers/playstation-5/products/sony-dualsense-wireless-controller-for-playstation-5/11106262.html';
for(let a=1;a<=3;a++){
 let b;
 try{
  b=await chromium.launch({channel:'chrome',headless:false});
  const ctx=await b.newContext({locale:'en-US',timezoneId:'America/Los_Angeles',viewport:{width:1400,height:1000}});
  const page=await ctx.newPage();
  const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(8000);
  const o=await page.evaluate(()=>{
   const arr=[];for(const s of document.querySelectorAll('script[type="application/ld+json"]')){try{arr.push(JSON.parse(s.textContent))}catch(e){}}
   const flat=[];const w=n=>{if(Array.isArray(n))n.forEach(w);else if(n&&typeof n==='object'){flat.push(n);if(n['@graph'])w(n['@graph'])}};w(arr);
   const p=flat.find(n=>n['@type']==='Product');
   const g=document.querySelector('.product-availability.global-availability');
   return {name:p?p.name:null,
    offers:p?(Array.isArray(p.offers)?p.offers:[p.offers]).map(o=>({sku:o.sku,nm:o.name,pr:o.price,cond:(o.itemCondition||'').split('/').pop(),av:(o.availability||'').split('/').pop(),sel:o.seller&&o.seller.name})):null,
    gAvail:g?g.getAttribute('data-available'):null};
  });
  console.log('attempt'+a,'HTTP',r.status(),'|',o.name,'| DOM avail=',o.gAvail);
  for(const x of (o.offers||[])) console.log('   ',x.sku,x.nm,'$'+x.pr,x.cond,'->',x.av,'seller='+x.sel);
  try{await b.close()}catch(_){}
  break;
 }catch(e){ console.log('attempt'+a,'ERROR',String(e).split('\n')[0]); try{if(b)await b.close()}catch(_){} await new Promise(s=>setTimeout(s,12000)); }
}
