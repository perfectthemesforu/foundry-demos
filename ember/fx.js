/* FX — motion engine shared by the motion themes. Dependency-free. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hex = (h) => { h = (h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  /* ---------------- Shader field ---------------- */
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const NOISE = `vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
  float snoise(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));vec3 mm=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);mm=mm*mm;mm=mm*mm;vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 ox=floor(x+.5);vec3 a0=x-ox;mm*=1.79284291400159-.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(mm,g);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*snoise(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}
  float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}`;
  const HEAD = `precision highp float;uniform vec2 r;uniform float t;uniform vec2 m;uniform vec3 c1;uniform vec3 c2;uniform vec3 bg;` + NOISE;
  const MODES = {
    // Nova: aurora curtains + drifting stars
    aurora: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.05;
      float band=0.;for(int i=0;i<3;i++){float fi=float(i);float y=.55+.18*fi+.12*snoise(vec2(p.x*.8+tt*(1.+fi*.3),fi*3.1+tt));float w=.05+.04*fi;band+=smoothstep(w,0.,abs(uv.y-y))*(.6-.15*fi)*(0.6+.4*snoise(vec2(p.x*2.+tt*2.,fi)));}
      float md=length(p-vec2(m.x*r.x/r.y,m.y));band+=smoothstep(.5,0.,md)*.25;
      vec3 col=bg+c1*band*.9+c2*band*band*.8;
      float st=step(.998,hash(floor(gl_FragCoord.xy/1.5)))*(.5+.5*sin(t*2.+hash(floor(gl_FragCoord.xy))*20.));col+=st*.6;
      col=mix(bg,col,smoothstep(1.6,.2,length(uv-vec2(.5,.6))));
      col+=(hash(gl_FragCoord.xy+t)-.5)*.02;gl_FragColor=vec4(col,1.);}`,
    // Ember: rising smoke + embers
    smoke: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.08;
      vec2 q=vec2(fbm(p*1.5+vec2(0.,-tt*1.2)),fbm(p*1.5+vec2(5.2,-tt*.9)));float s=fbm(p*1.2+q*1.6+vec2(0.,-tt*1.5));
      float rise=smoothstep(1.1,.0,uv.y);float sm=smoothstep(-.2,.7,s)*rise;
      float md=length(p-vec2(m.x*r.x/r.y,m.y));sm+=smoothstep(.4,0.,md)*.2;
      float emb=step(.996,hash(floor((gl_FragCoord.xy+vec2(0.,t*60.))/2.)))*rise;
      vec3 col=mix(bg,c1,sm*.55);col=mix(col,c2,pow(sm,2.5)*.9);col+=emb*c2*1.2;
      col=mix(bg,col,smoothstep(1.4,.3,length(uv-vec2(.5,.35))));gl_FragColor=vec4(col,1.);}`,
    // Tide: water caustics
    caustics: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.25;
      vec2 k=p*3.;float c=0.;for(int i=0;i<3;i++){float fi=float(i);vec2 o=vec2(snoise(k+tt*.6+fi),snoise(k-tt*.5+fi*2.));c+=1./(1.+abs(snoise(k+o*.8+fi*5.))*14.);}
      c/=3.;float md=length(p-vec2(m.x*r.x/r.y,m.y));float ring=smoothstep(.02,0.,abs(md-fract(t*.4)*.9))*smoothstep(.9,0.,md)*.3;
      vec3 col=mix(bg,c1,c*1.6);col=mix(col,c2,pow(c,2.)*1.8);col+=ring*c2;
      col=mix(col,bg,smoothstep(.3,1.2,length(uv-vec2(.5,.55)))*.6);gl_FragColor=vec4(col,1.);}`,
    // Pulse: mesh gradient energy
    mesh: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.12;
      vec2 a=vec2(.3+.2*sin(tt),.6+.2*cos(tt*1.3)),b=vec2(.8+.15*cos(tt*.8),.3+.2*sin(tt*1.1)),c=vec2(m.x*r.x/r.y,m.y);a.x*=r.x/r.y;b.x*=r.x/r.y;
      float da=exp(-length(p-a)*2.2),db=exp(-length(p-b)*2.2),dc=exp(-length(p-c)*2.6)*.8;
      float n=fbm(p*2.+tt)*.15;
      vec3 col=bg+c1*(da+n)+c2*(db+dc);col+=pow(da*db,.5)*.5;
      float grain=(hash(gl_FragCoord.xy)-.5)*.03;col+=grain;gl_FragColor=vec4(col,1.);}`,
    // Prism: iridescent sheen bands
    prism: HEAD + `vec3 hue(float h){return .5+.5*cos(6.2832*(h+vec3(0.,.33,.67)));}
      void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.06;
      float f=fbm(p*1.1+tt)+.5*snoise(p*3.-tt*2.);float h=f*.5+uv.x*.3+tt;
      float md=length(p-vec2(m.x*r.x/r.y,m.y));float sh=smoothstep(.9,0.,md)*.5+smoothstep(-.4,.8,f)*.35;
      vec3 col=mix(bg,hue(h),sh);col=mix(col,c2,smoothstep(.6,1.,f)*.3);
      col=mix(col,bg,smoothstep(.4,1.3,length(uv-vec2(.5,.5)))*.7);gl_FragColor=vec4(col,1.);}`
  };
  function field(canvas) {
    const mode = canvas.dataset.fx || 'aurora', gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }); if (!gl) return null;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(o)); return o; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, MODES[mode] || MODES.aurora)); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null; gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n); const d = canvas.dataset;
    gl.uniform3fv(U('c1'), hex(d.c1)); gl.uniform3fv(U('c2'), hex(d.c2)); gl.uniform3fv(U('bg'), hex(d.bg));
    let w, h, mx = .4, my = .5, tx = .4, ty = .5, running = true, raf;
    const resize = () => { const s = Math.min(devicePixelRatio, 1.5) * .6; w = canvas.width = Math.max(2, canvas.clientWidth * s | 0); h = canvas.height = Math.max(2, canvas.clientHeight * s | 0); gl.viewport(0, 0, w, h); gl.uniform2f(U('r'), w, h); };
    const t0 = performance.now(); const frame = () => { if (!running) return; mx += (tx - mx) * .05; my += (ty - my) * .05; gl.uniform2f(U('m'), mx, my); gl.uniform1f(U('t'), (performance.now() - t0) / 1000); gl.drawArrays(gl.TRIANGLES, 0, 3); raf = requestAnimationFrame(frame); };
    resize(); addEventListener('resize', resize);
    const host = canvas.closest('section') || canvas.parentElement; host.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width; ty = 1 - (e.clientY - r.top) / r.height; }, { passive: true });
    new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) frame(); else cancelAnimationFrame(raf); }).observe(canvas);
    if (reduced) { gl.uniform2f(U('m'), mx, my); gl.uniform1f(U('t'), 12); gl.drawArrays(gl.TRIANGLES, 0, 3); running = false; } else frame();
    return true;
  }
  $$('canvas[data-fx]').forEach((c) => { if (!field(c)) c.remove(); });
  $$('.hero').forEach((h) => requestAnimationFrame(() => h.classList.add('is-ready')));

  /* ---------------- Scroll-driven 3D rotation (pinned) ---------------- */
  $$('.pin').forEach((pin) => {
    const cv = $('canvas[data-bottle]', pin), steps = $$('.pin__step', pin), bar = $('.pin__bar i', pin); if (!cv) return;
    const run = () => {
      const r = pin.getBoundingClientRect(); const total = r.height - innerHeight; const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
      const api = cv._fx3d; if (api) api.set({ yaw: -.35 + p * Math.PI * 2, pitch: .08 + Math.sin(p * Math.PI) * .25, scrollDriven: true });
      const i = Math.min(steps.length - 1, Math.floor(p * steps.length)); steps.forEach((s, k) => s.classList.toggle('is-on', k === i)); if (bar) bar.style.setProperty('--p', (p * 100) + '%');
    };
    run(); addEventListener('scroll', run, { passive: true }); addEventListener('resize', run);
  });

  /* ---------------- Velocity skew ---------------- */
  if (!reduced) { const els = $$('.skew'); if (els.length) { let last = scrollY, v = 0; const tick = () => { const y = scrollY; v += ((y - last) - v) * .15; last = y; const k = Math.max(-6, Math.min(6, v * .08)); els.forEach((el) => { el.style.transform = `skewY(${k.toFixed(2)}deg)`; }); requestAnimationFrame(tick); }; tick(); } }

  /* ---------------- Burn-in text ---------------- */
  const splitBurn = (el, start) => { let i = start; const text = el.textContent; el.textContent = ''; text.split(/(\s+)/).forEach((part) => { if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(' ')); return; } const w = document.createElement('span'); w.style.whiteSpace = 'nowrap'; part.split('').forEach((ch) => { const c = document.createElement('span'); c.className = 'ch'; c.textContent = ch; c.style.transitionDelay = (i++ * 35) + 'ms'; w.appendChild(c); }); el.appendChild(w); }); return i; };
  $$('.burn').forEach((el) => { if (el.dataset.split) return; el.dataset.split = '1'; const lines = $$('.ln > span', el); let i = 0; if (lines.length) lines.forEach((ln) => { i = splitBurn(ln, i); }); else splitBurn(el, 0); });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: .2 });
  $$('.burn, .mask-reveal, .reveal').forEach((el) => io.observe(el));

  /* ---------------- Ripple cursor ---------------- */
  const rc = $('canvas.ripple-cursor');
  if (rc && fine && !reduced) {
    const ctx = rc.getContext('2d'); let rings = []; const col = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7DF9FF';
    const rs = () => { rc.width = innerWidth * devicePixelRatio; rc.height = innerHeight * devicePixelRatio; }; rs(); addEventListener('resize', rs);
    let lastT = 0; addEventListener('pointermove', (e) => { const now = performance.now(); if (now - lastT < 70) return; lastT = now; rings.push({ x: e.clientX, y: e.clientY, r: 4, a: .5 }); }, { passive: true });
    const tick = () => { ctx.clearRect(0, 0, rc.width, rc.height); ctx.save(); ctx.scale(devicePixelRatio, devicePixelRatio); rings = rings.filter((g) => g.a > .01); rings.forEach((g) => { g.r += 1.8; g.a *= .93; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.strokeStyle = col; ctx.globalAlpha = g.a; ctx.lineWidth = 1.2; ctx.stroke(); }); ctx.restore(); requestAnimationFrame(tick); }; tick();
  }

  /* ---------------- Holographic hover ---------------- */
  $$('.holo').forEach((el) => el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; el.style.setProperty('--mx', (x * 100) + '%'); el.style.setProperty('--my', (y * 100) + '%'); el.style.setProperty('--a', (x * 360) + 'deg'); }));

  /* ---------------- Split-flap counters ---------------- */
  const fio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; fio.unobserve(e.target); const el = e.target, target = String(el.dataset.flap); el.innerHTML = target.split('').map((c) => `<span>${/\d/.test(c) ? '0' : c}</span>`).join('');
    const spans = $$('span', el); let step = 0; const max = 14; const iv = setInterval(() => { step++; spans.forEach((s, i) => { const c = target[i]; if (!/\d/.test(c)) return; const done = step >= max - (spans.length - i); s.textContent = done ? c : String(Math.floor(Math.random() * 10)); if (!done) { s.classList.remove('flip'); void s.offsetWidth; s.classList.add('flip'); } }); if (step >= max) clearInterval(iv); }, reduced ? 0 : 90);
  }), { threshold: .5 });
  $$('[data-flap]').forEach((el) => fio.observe(el));

  /* ---------------- Lookbook drag-scroll ---------------- */
  $$('.lookbook').forEach((lb) => { let down = false, sx = 0, sl = 0; lb.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sl = lb.scrollLeft; lb.setPointerCapture(e.pointerId); }); lb.addEventListener('pointermove', (e) => { if (down) lb.scrollLeft = sl - (e.clientX - sx); }); lb.addEventListener('pointerup', () => { down = false; }); });
})();
