import { chromium } from 'playwright';
const targets=[
 ['DUALSENSE_REAL','https://www.gamestop.com/gaming-accessories/controllers/playstation-5/products/sony-dualsense-wireless-controller-for-playstation-5/11106262.html'],
 ['DISC_DRIVE','https://www.gamestop.com/consoles-hardware/playstation-5/consoles/products/sony-disc-drive-for-playstation-5-pro-and-digital-edition-consoles/20009376.html'],
];
for(const [tag,url] of targets){
 let b;
 try{
  b=await chromium.launch({channel:'chrome',headless:false});
  const ctx=await b.newContext({locale:'en-US',timezoneId:'America/Los_Angeles',viewport:{width:1400,height:1000}});
  const page=await ctx.newPage();
  const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(7000);
  const o=await page.evaluate(()=>{
   const arr=[];for(const s of document.querySelectorAll('script[type="application/ld+json"]')){try{arr.push(JSON.parse(s.textContent))}catch(e){}}
   const flat=[];const w=n=>{if(Array.isArray(n))n.forEach(w);else if(n&&typeof n==='object'){flat.push(n);if(n['@graph'])w(n['@graph'])}};w(arr);
   const p=flat.find(n=>n['@type']==='Product');
   const g=document.querySelector('.product-availability.global-availability');
   const atc=document.querySelector('.add-to-cart');
   return {name:p?p.name:null,
    offers:p?(Array.isArray(p.offers)?p.offers:[p.offers]).map(o=>({sku:o.sku,nm:o.name,pr:o.price,cond:(o.itemCondition||'').split('/').pop(),av:(o.availability||'').split('/').pop(),sel:o.seller&&o.seller.name})):null,
    gAvail:g?g.getAttribute('data-available'):null,gReady:g?g.getAttribute('data-ready-to-order'):null,
    atc:atc?(atc.innerText||'').trim():null,dis:atc?!!atc.disabled:null};
  });
  console.log(tag,'| HTTP',r.status(),'|',o.name);
  for(const x of (o.offers||[])) console.log('   ',x.sku,x.nm,'$'+x.pr,x.cond,'->',x.av,'seller='+x.sel);
  console.log('   DOM avail=',o.gAvail,'ready=',o.gReady,'atc=',JSON.stringify(o.atc),'dis=',o.dis);
 }catch(e){console.log(tag,'ERROR',String(e).split('\n')[0]);}
 try{if(b)await b.close()}catch(_){}
 await new Promise(s=>setTimeout(s,8000));
}
