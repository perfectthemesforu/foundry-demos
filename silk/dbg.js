const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] }); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('file:///home/claude/silk-preview/index.html'); await p.waitForTimeout(1200);
console.log(await p.evaluate(() => { const c=document.querySelector('.hero__3d'); const gl=c.getContext('webgl'); const a=gl.getContextAttributes(); const px=new Uint8Array(4); gl.readPixels(2,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); return JSON.stringify({attrs:a, px:Array.from(px), cs:getComputedStyle(c).backgroundColor}); }));
await b.close(); })();
