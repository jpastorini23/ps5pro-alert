import { chromium } from 'playwright';
const URL='https://www.gamestop.com/consoles-hardware/playstation-5/consoles/products/sony-playstation-5-pro-console/20015604.html';
const b=await chromium.launch({channel:'chrome',headless:false});
const ctx=await b.newContext({locale:'en-US',timezoneId:'America/Los_Angeles',viewport:{width:1400,height:1000}});
const page=await ctx.newPage();
const net=[];
page.on('response', r=>{ const u=r.url(); if(/gamestop\.com/.test(u) && !/\.(png|jpg|jpeg|webp|svg|gif|woff2?|css|ico)(\?|$)/i.test(u)) net.push({s:r.status(), u:u.slice(0,150)}); });
await page.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForTimeout(9000);

const cond = await page.evaluate(()=>{
  // condition selector state
  const radios=[...document.querySelectorAll('input[type=radio], .condition-item, [data-attr="condition"] a, .attribute a, .swatch-condition')].slice(0,30)
    .map(e=>({tag:e.tagName, cls:(e.className||'').toString().slice(0,90), txt:(e.innerText||e.value||'').trim().slice(0,40), checked:e.checked, sel:(e.className||'').toString().includes('selected')||e.getAttribute?.('aria-checked')==='true'}));
  const atc=document.querySelector('.add-to-cart');
  const g=document.querySelector('.product-availability.global-availability');
  return { radios, pid: atc?atc.getAttribute('data-pid'):null, atcTxt:atc?(atc.innerText||'').trim():null, atcDis:atc?!!atc.disabled:null,
           gAvail:g?g.getAttribute('data-available'):null, gPid:g?g.getAttribute('data-pid'):null,
           url:location.href };
});
const blocked=net.filter(x=>x.s===403||x.s>=400);
console.log(JSON.stringify({ blockedCount:blocked.length, blocked, totalNet:net.length, cond }, null, 2));
await b.close();
