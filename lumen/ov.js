const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-webgl'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('file:///home/claude/lumen-preview/index.html'); await p.waitForTimeout(800);
console.log(await p.evaluate(() => { const out=[]; document.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect(); if(r.right>392 && getComputedStyle(e).position!=='fixed') out.push(e.tagName+'.'+e.className+' '+Math.round(r.right));}); return out.slice(0,15).join('\n')+'\n'+document.documentElement.scrollWidth; }));
await b.close(); })();
