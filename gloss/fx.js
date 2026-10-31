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
      col=mix(col,bg,smoothstep(.4,1.3,length(uv-vec2(.5,.5)))*.7);gl_FragColor=vec4(col,1.);}`,
    // Verde: soft organic blooms drifting
    bloom: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.07;
      float f=0.;for(int i=0;i<5;i++){float fi=float(i);vec2 c=vec2(.2+.6*hash(vec2(fi,1.)),.25+.55*hash(vec2(fi,7.)));c.x*=r.x/r.y;c+=vec2(sin(tt*(.7+fi*.2)+fi),cos(tt*(.5+fi*.15)+fi*2.))*.12;float d=length(p-c);f+=smoothstep(.55,0.,d)*(.5+.5*snoise(p*2.+fi+tt));}
      float md=length(p-vec2(m.x*r.x/r.y,m.y));f+=smoothstep(.45,0.,md)*.35;
      vec3 col=mix(bg,c2,smoothstep(.0,.9,f)*.55);col=mix(col,c1,smoothstep(.5,1.4,f)*.5);
      col+=fbm(p*6.+tt)*.02;gl_FragColor=vec4(col,1.);}`,
    // Grain: rising steam wisps
    steam: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.1;
      float s=fbm(vec2(p.x*2.2,p.y*1.4-tt*1.6))+.5*fbm(vec2(p.x*4.+3.,p.y*2.-tt*2.4));
      float rise=smoothstep(1.05,.05,uv.y)*smoothstep(.0,.25,uv.y);float w=smoothstep(.1,.9,s)*rise;
      float md=length(p-vec2(m.x*r.x/r.y,m.y));w+=smoothstep(.4,0.,md)*.15;
      vec3 col=mix(bg,c2,w*.5);col=mix(col,c1,pow(w,2.)*.5);
      col=mix(bg,col,smoothstep(1.3,.2,length(uv-vec2(.5,.4))));gl_FragColor=vec4(col,1.);}`,
    // Haven: dusk gradient, slow breathing, faint stars
    dusk: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.04;
      float g=smoothstep(-.2,1.1,uv.y+.25*snoise(vec2(p.x*.8+tt,tt*.7)));
      float glow=exp(-length(p-vec2(.62*r.x/r.y,.32+.03*sin(t*.3)))*2.4);
      float md=length(p-vec2(m.x*r.x/r.y,m.y));glow+=smoothstep(.6,0.,md)*.25;
      vec3 col=mix(c2,bg,g);col=mix(col,c1,glow*.8);
      float st=step(.997,hash(floor(gl_FragCoord.xy/1.7)))*(.5+.5*sin(t*1.2+hash(floor(gl_FragCoord.xy))*30.))*smoothstep(.3,.9,uv.y);col+=st*.5;
      gl_FragColor=vec4(col,1.);}`,
    // Forge: sparks rising from below + hot glow
    sparks: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;
      float glow=exp(-length(p-vec2(.5*r.x/r.y,-.1))*1.6)*(.8+.2*sin(t*3.));
      float sp=0.;for(int i=0;i<3;i++){float fi=float(i);vec2 g=floor((gl_FragCoord.xy+vec2(fi*37.,t*(90.+fi*40.)))/vec2(3.+fi));float h=hash(g+fi);sp+=step(.994-fi*.002,h)*smoothstep(1.,.0,uv.y)*(.6+.4*sin(t*9.+h*40.));}
      float md=length(p-vec2(m.x*r.x/r.y,m.y));glow+=smoothstep(.5,0.,md)*.3;
      vec3 col=bg+c1*glow*.9+c2*glow*glow*.3;col+=sp*mix(c1,vec3(1.),.4)*1.3;
      col+=fbm(p*3.+t*.1)*.015;gl_FragColor=vec4(col,1.);}`,
    // Pixel: drifting grid + scanlines + occasional glitch
    scan: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;
      float gl=step(.97,fract(p.x*12.+t*.05))+step(.97,fract(p.y*12.-t*.08));gl*=.35*smoothstep(1.2,.2,length(uv-vec2(.5,.5)));
      float sl=.5+.5*sin(gl_FragCoord.y*1.8);float glitch=step(.985,hash(vec2(floor(t*6.),floor(uv.y*40.))))*step(.5,hash(vec2(floor(t*6.)+1.,floor(uv.y*40.))));
      float md=length(p-vec2(m.x*r.x/r.y,m.y));float blob=exp(-md*2.2);
      vec3 col=bg+c1*(gl+blob*.5)+c2*(blob*blob*.6+glitch*.5);col*=.92+.08*sl;
      gl_FragColor=vec4(col,1.);}`,
    // Bambino: soft confetti dots floating up
    confetti: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;
      vec3 col=bg;for(int i=0;i<3;i++){float fi=float(i);vec2 q=p*(4.+fi*2.)+vec2(fi*3.,-t*(.06+fi*.03));vec2 g=floor(q);vec2 f=fract(q)-.5;float h=hash(g+fi);vec2 c=vec2(hash(g+1.),hash(g+2.))-.5;float d=length(f-c*.6)-(.06+.05*h);float a=smoothstep(.02,-.02,d)*step(.55,h)*(.5+.5*sin(t+h*20.));col=mix(col,mix(c1,c2,step(.8,h)),a*.7);}
      float md=length(p-vec2(m.x*r.x/r.y,m.y));col=mix(col,c2,smoothstep(.5,0.,md)*.15);
      gl_FragColor=vec4(col,1.);}`,
    // Cellar: slow velvet folds
    velvet: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.05;
      float f=fbm(p*1.6+vec2(tt,-tt*.6));float f2=fbm(p*3.2-vec2(tt*.4,tt));float v=smoothstep(-.3,.8,f+.4*f2);
      float md=length(p-vec2(m.x*r.x/r.y,m.y));v+=smoothstep(.5,0.,md)*.2;
      vec3 col=mix(bg,c1,v*.5);col=mix(col,c2,pow(v,3.)*.35);
      col=mix(col,bg,smoothstep(.5,1.3,length(uv-vec2(.5,.5)))*.6);gl_FragColor=vec4(col,1.);}`,
    // Sol: sun rays
    flare: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;vec2 s=vec2(.7*r.x/r.y,.85);vec2 d=p-s;float a=atan(d.y,d.x);float l=length(d);
      float rays=pow(.5+.5*sin(a*14.+t*.3),3.)*.6+pow(.5+.5*sin(a*5.-t*.2),2.)*.4;rays*=smoothstep(1.6,.1,l);
      float disc=exp(-l*3.);float md=length(p-vec2(m.x*r.x/r.y,m.y));disc+=smoothstep(.5,0.,md)*.2;
      vec3 col=bg+c2*rays*.5+c1*disc*.9;col+=fbm(p*4.+t*.05)*.02;gl_FragColor=vec4(col,1.);}`,
    // Mono: drifting fine grid with a soft spotlight
    grid: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;vec2 q=p*22.+vec2(t*.15,0.);
      float g=max(step(.96,fract(q.x)),step(.96,fract(q.y)));float md=length(p-vec2(m.x*r.x/r.y,m.y));float spot=smoothstep(.7,0.,md);
      float big=max(step(.985,fract(q.x/4.)),step(.985,fract(q.y/4.)));
      vec3 col=mix(bg,c1,g*.08+big*.14);col=mix(col,c2,spot*g*.5);col=mix(col,c1,spot*.04);
      gl_FragColor=vec4(col,1.);}`,
    // Kiln: glaze swirl
    glaze: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.04;
      vec2 q=vec2(fbm(p*.9+tt),fbm(p*.9+vec2(4.1,2.3)-tt));float f=fbm(p*1.1+q*1.8);float v=smoothstep(-.4,.7,f);
      float md=length(p-vec2(m.x*r.x/r.y,m.y));v+=smoothstep(.5,0.,md)*.2;
      vec3 col=mix(bg,c2,v*.3);col=mix(col,c1,smoothstep(.6,1.,v)*.3);float sheen=pow(max(0.,1.-abs(f*2.)),8.)*.08;col+=sheen;
      col=mix(col,bg,smoothstep(.5,1.3,length(uv-vec2(.5,.5)))*.5);gl_FragColor=vec4(col,1.);}`,
    // Aether: flowing ribbons
    ribbons: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.12;vec3 col=bg;
      for(int i=0;i<4;i++){float fi=float(i);float y=.3+.15*fi+.12*snoise(vec2(p.x*1.2+tt*(.6+fi*.2),fi*2.))+.05*sin(p.x*6.+tt*3.+fi);float w=.012+.006*fi;float b=smoothstep(w,0.,abs(uv.y-y));col=mix(col,mix(c1,c2,fi/3.),b*(.9-.15*fi));col+=mix(c1,c2,fi/3.)*smoothstep(.12,0.,abs(uv.y-y))*.12;}
      float md=length(p-vec2(m.x*r.x/r.y,m.y));col+=c1*smoothstep(.5,0.,md)*.12;gl_FragColor=vec4(col,1.);}`,
    // Orbit: ink drops spreading
    ink: HEAD + `void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.06;
      float f=0.;for(int i=0;i<4;i++){float fi=float(i);vec2 c=vec2(.25+.5*hash(vec2(fi,3.)),.25+.5*hash(vec2(fi,9.)));c.x*=r.x/r.y;float rad=.15+.25*fract(tt*.5+fi*.25);float d=length(p-c)+.08*fbm(p*4.+fi+tt);f+=smoothstep(rad,rad-.05,d)*(1.-fract(tt*.5+fi*.25))*.9;}
      float md=length(p-vec2(m.x*r.x/r.y,m.y));f+=smoothstep(.35,0.,md)*.5;
      vec3 col=mix(bg,c1,clamp(f,0.,1.)*.85);col=mix(col,c2,smoothstep(.9,1.6,f)*.5);col+=(fbm(p*8.)-.5)*.03;gl_FragColor=vec4(col,1.);}`
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
    canvas._fx = { recolor: () => { gl.useProgram(prog); gl.uniform3fv(U('c1'), hex(d.c1)); gl.uniform3fv(U('c2'), hex(d.c2)); gl.uniform3fv(U('bg'), hex(d.bg)); if (!running || reduced) { gl.uniform2f(U('m'), mx, my); gl.uniform1f(U('t'), 12); gl.drawArrays(gl.TRIANGLES, 0, 3); } } };
    return true;
  }
  const fxio = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; const c = e.target; fxio.unobserve(c); if (c.dataset.fxInit) return; c.dataset.fxInit = '1'; if (!field(c)) { c.dataset.fxInit = ''; c.style.display = 'none'; } }), { rootMargin: '300px 0px' });
  $$('canvas[data-fx]').forEach((c) => fxio.observe(c));
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

  /* ---------------- Marquee text (kinetic, scroll-speed aware) ---------------- */
  $$('.mq').forEach((mq) => { const track = $('.mq__track', mq); if (!track) return; const clone = track.cloneNode(true); clone.setAttribute('aria-hidden', 'true'); mq.appendChild(clone); let x = 0, last = scrollY, boost = 0; const dir = mq.dataset.dir === 'right' ? 1 : -1; const base = parseFloat(mq.dataset.speed || '0.6'); const tick = () => { const y = scrollY; boost += ((Math.abs(y - last) * .3) - boost) * .1; last = y; x += (base + boost) * dir * (reduced ? 0 : 1); const w = track.offsetWidth; if (x < -w) x += w; if (x > 0) x -= w; track.style.transform = clone.style.transform = `translateX(${x}px)`; requestAnimationFrame(tick); }; tick(); });

  /* ---------------- Scrolly: sticky media, steps swap ---------------- */
  $$('.scrolly').forEach((sc) => { const steps = $$('.scrolly__step', sc), imgs = $$('.scrolly__media img', sc); const o = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; const i = steps.indexOf(e.target); steps.forEach((s, j) => s.classList.toggle('is-on', j === i)); imgs.forEach((im, j) => im.classList.toggle('is-on', j === i)); }), { rootMargin: '-45% 0px -45% 0px' }); steps.forEach((st) => o.observe(st)); if (steps[0]) { steps[0].classList.add('is-on'); imgs[0] && imgs[0].classList.add('is-on'); } });

  /* ---------------- Compare slider (before / after) ---------------- */
  $$('.cmp').forEach((c) => { const set = (p) => { p = Math.max(0, Math.min(100, p)); c.style.setProperty('--p', p + '%'); }; set(parseFloat(c.dataset.start || '50')); let down = false; const move = (e) => { const r = c.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100); }; c.addEventListener('pointerdown', (e) => { down = true; c.setPointerCapture(e.pointerId); move(e); }); c.addEventListener('pointermove', (e) => { if (down) move(e); }); c.addEventListener('pointerup', () => { down = false; }); c.addEventListener('keydown', (e) => { const p = parseFloat(getComputedStyle(c).getPropertyValue('--p')); if (e.key === 'ArrowLeft') set(p - 4); if (e.key === 'ArrowRight') set(p + 4); }); });

  /* ---------------- Hotspots ---------------- */
  $$('.hs').forEach((h) => { const dots = $$('.hs__dot', h); dots.forEach((d) => d.addEventListener('click', () => { const on = d.classList.contains('is-on'); dots.forEach((x) => x.classList.remove('is-on')); if (!on) d.classList.add('is-on'); })); document.addEventListener('click', (e) => { if (!h.contains(e.target)) dots.forEach((x) => x.classList.remove('is-on')); }); });

  /* ---------------- Quote slider ---------------- */
  $$('.qs').forEach((q) => { const track = $('.qs__track', q), items = $$('.qs__item', q); let i = 0; const go = (n) => { i = (n + items.length) % items.length; track.style.transform = `translateX(${-i * 100}%)`; $$('.qs__dots button', q).forEach((b, j) => b.setAttribute('aria-current', j === i ? 'true' : 'false')); }; $('.qs__prev', q) && $('.qs__prev', q).addEventListener('click', () => go(i - 1)); $('.qs__next', q) && $('.qs__next', q).addEventListener('click', () => go(i + 1)); const dots = $('.qs__dots', q); if (dots) { dots.innerHTML = items.map((_, j) => `<button type="button" aria-label="Slide ${j + 1}"></button>`).join(''); $$('button', dots).forEach((b, j) => b.addEventListener('click', () => go(j))); } go(0); if (!reduced && q.dataset.auto !== 'false') { let iv = setInterval(() => go(i + 1), 5500); q.addEventListener('pointerenter', () => clearInterval(iv)); q.addEventListener('pointerleave', () => { iv = setInterval(() => go(i + 1), 5500); }); } });

  /* ---------------- Countdown ---------------- */
  $$('[data-countdown]').forEach((cd) => { let end; const key = 'x_cd_' + (cd.dataset.key || 'offer'); if (cd.dataset.countdown === 'visitor') { try { end = +sessionStorage.getItem(key) || 0; if (!end) { end = Date.now() + parseFloat(cd.dataset.minutes || '15') * 60000; sessionStorage.setItem(key, end); } } catch (e) { end = Date.now() + 900000; } } else end = new Date(cd.dataset.countdown).getTime(); const cells = $$('[data-cd]', cd); const tick = () => { let d = Math.max(0, end - Date.now()); if (!d) { cd.classList.add('is-over'); if (cd.dataset.hide !== 'false') cd.hidden = true; return; } const v = { d: Math.floor(d / 864e5), h: Math.floor(d / 36e5) % 24, m: Math.floor(d / 6e4) % 60, s: Math.floor(d / 1e3) % 60 }; cells.forEach((c) => { const n = String(v[c.dataset.cd]).padStart(2, '0'); if (c.textContent !== n) { c.textContent = n; c.classList.remove('tick'); void c.offsetWidth; c.classList.add('tick'); } }); setTimeout(tick, 1000); }; tick(); });

  /* ---------------- Bento spotlight ---------------- */
  if (fine) $$('.bento').forEach((b) => b.addEventListener('pointermove', (e) => { $$('.bento__cell', b).forEach((c) => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }); }));

  /* ---------------- Tilt cards ---------------- */
  if (fine && !reduced) $$('.tilt').forEach((el) => { el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.transform = `perspective(900px) rotateX(${-y * 10}deg) rotateY(${x * 12}deg) translateY(-4px)`; }); el.addEventListener('pointerleave', () => { el.style.transform = ''; }); });

  /* ---------------- Stagger reveal of grids ---------------- */
  $$('[data-stagger]').forEach((g) => { Array.from(g.children).forEach((c, i) => { c.classList.add('reveal'); c.style.transitionDelay = (i * 70) + 'ms'; io.observe(c); }); });

  /* ---------------- set 4: horizontal scroll progress, hover-list image, terminal typing, deck, parallax, chapters ---------------- */
  $$('.hscroll').forEach((h) => { const bar = h.parentElement.querySelector('.hbar i'); if (!bar) return; const upd = () => { const max = h.scrollWidth - h.clientWidth; const p = max ? h.scrollLeft / max : 0; bar.style.width = (100 * h.clientWidth / h.scrollWidth) + '%'; bar.style.transform = `translateX(${p * 100 * (h.scrollWidth / h.clientWidth - 1)}%)`; }; h.addEventListener('scroll', upd, { passive: true }); upd(); let down = false, sx = 0, sl = 0; h.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sl = h.scrollLeft; }); h.addEventListener('pointermove', (e) => { if (down) h.scrollLeft = sl - (e.clientX - sx); }); addEventListener('pointerup', () => { down = false; }); });
  $$('.hlist').forEach((l) => { if (!fine) return; const img = document.createElement('img'); img.className = 'hlist__img'; img.alt = ''; document.body.appendChild(img); let raf; l.addEventListener('pointermove', (e) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { img.style.left = e.clientX + 'px'; img.style.top = e.clientY + 'px'; }); }); $$('a', l).forEach((a) => { a.addEventListener('pointerenter', () => { img.src = a.dataset.img; img.classList.add('is-on'); }); a.addEventListener('pointerleave', () => img.classList.remove('is-on')); }); });
  const tio = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; tio.unobserve(e.target); e.target.classList.add('is-in'); $$('.ln', e.target).forEach((ln, i) => { ln.style.transitionDelay = (i * 120) + 'ms'; }); }), { threshold: .3 }); $$('.term').forEach((t) => tio.observe(t));
  $$('.deck').forEach((d) => { const cards = $$('.deck__card', d); let i = 0; const lay = () => cards.forEach((c, j) => { const k = (j - i + cards.length) % cards.length; c.dataset.i = k; c.classList.toggle('is-out', false); }); lay(); const next = () => { const c = cards[i]; c.classList.add('is-out'); setTimeout(() => { i = (i + 1) % cards.length; lay(); }, 450); }; const prev = () => { i = (i - 1 + cards.length) % cards.length; lay(); }; const nav = d.parentElement.querySelector('.deck__nav'); if (nav) { $('.deck__prev', nav) && $('.deck__prev', nav).addEventListener('click', prev); $('.deck__next', nav) && $('.deck__next', nav).addEventListener('click', next); } let sx = 0; d.addEventListener('pointerdown', (e) => { sx = e.clientX; }); d.addEventListener('pointerup', (e) => { if (e.clientX - sx > 40) next(); else if (sx - e.clientX > 40) next(); }); if (!reduced) { let iv = setInterval(next, 4000); d.addEventListener('pointerenter', () => clearInterval(iv)); d.addEventListener('pointerleave', () => { iv = setInterval(next, 4000); }); } });
  if (!reduced) { const px = $$('[data-parallax]'); if (px.length) { const tick = () => { px.forEach((el) => { const r = el.getBoundingClientRect(); const c = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; el.style.transform = `translateY(${-c * parseFloat(el.dataset.parallax || '30')}px)`; }); requestAnimationFrame(tick); }; tick(); } }
  const cio = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('is-in', e.isIntersecting)), { threshold: .35 }); $$('.chapter').forEach((c) => cio.observe(c));
  $$('.poster').forEach((p) => requestAnimationFrame(() => p.classList.add('is-ready')));

  /* ---------------- set 5: store-pattern components ---------------- */
  $$('[data-rail]').forEach((r) => { const sec = r.closest('section'); const step = () => (r.querySelector('.card')?.getBoundingClientRect().width || 300) + 16; $('.rail__prev', sec)?.addEventListener('click', () => r.scrollBy({ left: -step() * 2, behavior: 'smooth' })); $('.rail__next', sec)?.addEventListener('click', () => r.scrollBy({ left: step() * 2, behavior: 'smooth' })); const bar = $('.rail__bar i', sec); if (bar) { const upd = () => { const max = r.scrollWidth - r.clientWidth; const p = max > 0 ? r.scrollLeft / max : 0; bar.style.width = (100 * r.clientWidth / r.scrollWidth) + '%'; bar.style.transform = `translateX(${p * 100 * (r.scrollWidth / r.clientWidth - 1)}%)`; }; r.addEventListener('scroll', upd, { passive: true }); upd(); } });
  $$('.tog').forEach((t) => { const sec = t.closest('section'); $$('.tog__btn', t).forEach((b) => b.addEventListener('click', () => { if (b.getAttribute('aria-selected') === 'true') return; $$('.tog__btn', t).forEach((x) => x.setAttribute('aria-selected', String(x === b))); t.classList.toggle('is-b', b.dataset.tog === 'b'); const cur = $('.tog__panel:not([hidden])', sec), nxt = $(`.tog__panel[data-panel="${b.dataset.tog}"]`, sec); if (!nxt || cur === nxt) return; cur.classList.add('is-out'); setTimeout(() => { cur.hidden = true; cur.classList.remove('is-out'); nxt.hidden = false; nxt.classList.add('is-out'); requestAnimationFrame(() => requestAnimationFrame(() => nxt.classList.remove('is-out'))); $$('[data-stagger] > *', nxt).forEach((el, i) => { el.style.transitionDelay = (i * 60) + 'ms'; }); }, 300); })); });
  $$('[data-quiz]').forEach((q) => { const steps = $$('.quiz__step', q), bar = $('.quiz__bar i', q), res = $('.quiz__result', q); const picks = []; let i = 0; const prog = () => { bar.style.width = ((i) / steps.length * 100) + '%'; }; prog(); steps.forEach((st, k) => $$('.quiz__opt', st).forEach((o) => o.addEventListener('click', () => { $$('.quiz__opt', st).forEach((x) => x.classList.remove('is-picked')); o.classList.add('is-picked'); picks[k] = o.textContent.trim(); st.classList.add('is-out'); setTimeout(() => { st.hidden = true; st.classList.remove('is-out'); i = k + 1; prog(); if (steps[i]) { steps[i].hidden = false; steps[i].classList.add('is-in'); } else if (res) { res.hidden = false; const p = $('.quiz__picks', res); if (p) p.textContent = picks.join(' · '); } }, 350); }))); $('.quiz__again', q)?.addEventListener('click', () => { res.hidden = true; i = 0; picks.length = 0; prog(); steps.forEach((s, k) => { s.hidden = k !== 0; }); }); });
  $$('[data-bundle]').forEach((bb) => { const cur = bb.dataset.currency || '$', t2 = parseFloat(bb.dataset.t2 || 0), t3 = parseFloat(bb.dataset.t3 || 0); const items = $$('.bb__item', bb), count = $('.bb__count', bb), was = $('.bb__was', bb), now = $('.bb__now', bb), save = $('.bb__save', bb), add = $('.bb__add', bb); const fmt = (n) => cur + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0); const upd = () => { const sel = items.filter((x) => x.getAttribute('aria-pressed') === 'true'); const sum = sel.reduce((a, x) => a + parseFloat(x.dataset.price || 0), 0); const pct = sel.length >= 3 ? t3 : sel.length === 2 ? t2 : 0; count.textContent = sel.length; now.textContent = fmt(sum * (1 - pct / 100)); was.textContent = pct ? fmt(sum) : ''; save.textContent = pct ? `save ${pct}%` : ''; save.classList.toggle('is-on', !!pct); add.disabled = sel.length === 0; }; items.forEach((x) => { x.setAttribute('aria-pressed', 'false'); x.addEventListener('click', () => { x.setAttribute('aria-pressed', String(x.getAttribute('aria-pressed') !== 'true')); upd(); }); }); upd(); add?.addEventListener('click', async () => { const sel = items.filter((x) => x.getAttribute('aria-pressed') === 'true'); const lines = sel.map((x) => ({ id: parseInt(x.dataset.vid, 10), quantity: 1 })).filter((l) => l.id); const label = add.querySelector('span') || add; const done = () => { label.textContent = 'Added to cart'; setTimeout(() => { label.textContent = add.dataset.label || 'Add set to cart'; }, 2000); document.dispatchEvent(new CustomEvent('fx:cart:added')); }; if (!lines.length || !window.Shopify) { done(); return; } add.disabled = true; try { await fetch((window.routes?.cart_add_url || '/cart/add') + '.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: lines }) }); done(); $('[data-cart-open]')?.click(); } catch (e) { label.textContent = 'Could not add'; } finally { add.disabled = false; } }); if (add) add.dataset.label = (add.querySelector('span') || add).textContent; });
  $$('[data-swatch]').forEach((m) => { const sec = m.closest('section'); const tint = $('.shade__tint', m), name = $('.shade__name', m); const set = (b) => { tint.style.background = b.dataset.tint; name.textContent = b.dataset.name; $$('.shade__btn', sec).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }; const btns = $$('.shade__btn', sec); btns.forEach((b) => b.addEventListener('click', () => set(b))); if (btns[0]) set(btns[0]); });
  $$('.tabs').forEach((t) => { const sec = t.closest('section'); const ink = $('.tabs__ink', t); const place = (b) => { if (!ink) return; ink.style.left = b.offsetLeft + 'px'; ink.style.width = b.offsetWidth + 'px'; }; const btns = $$('.tabs__btn', t); btns.forEach((b) => b.addEventListener('click', () => { if (b.getAttribute('aria-selected') === 'true') return; btns.forEach((x) => x.setAttribute('aria-selected', String(x === b))); place(b); const cur = $('.tabs__panel:not([hidden])', sec), nxt = $(`.tabs__panel[data-panel="${b.dataset.tab}"]`, sec); if (!nxt) return; cur.classList.add('is-out'); setTimeout(() => { cur.hidden = true; cur.classList.remove('is-out'); nxt.hidden = false; nxt.classList.add('is-out'); requestAnimationFrame(() => requestAnimationFrame(() => nxt.classList.remove('is-out'))); }, 300); })); const first = btns.find((b) => b.getAttribute('aria-selected') === 'true') || btns[0]; if (first) { place(first); if (document.fonts?.ready) document.fonts.ready.then(() => place(first)); } });

  /* ---- one-product: shared add-to-cart, offer tiers, hero buy, sticky buy ---- */
  const cartApi = () => { const k = Object.keys(window).find((n) => /Cart$/.test(n) && window[n] && typeof window[n].add === 'function'); return k ? window[k] : null; };
  const addLines = async (lines, btn) => { const label = btn.querySelector('span') || btn; const orig = btn.dataset.label || label.textContent; const done = () => { label.textContent = 'Added to cart'; setTimeout(() => { label.textContent = orig; }, 1800); document.dispatchEvent(new CustomEvent('fx:cart:added')); }; lines = lines.filter((l) => l.id); btn.disabled = true; try { const api = cartApi(); if (api && lines.length) await api.add(lines); else if (lines.length) { await fetch((window.theme?.routes?.cart_add_url || '/cart/add') + '.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: lines }) }); $('[data-cart-open]')?.click(); } done(); } catch (e) { label.textContent = 'Could not add'; setTimeout(() => { label.textContent = orig; }, 1800); } finally { btn.disabled = false; } };
  $$('[data-offers]').forEach((o) => { const cur = o.dataset.currency || '$', unit = parseFloat(o.dataset.unit || 0), vid = parseInt(o.dataset.vid, 10); const radios = $$('input[type="radio"]', o), now = $('[data-offers-now]', o), was = $('[data-offers-was]', o), add = $('.offers__add', o); const fmt = (n) => cur + (Math.round(n * 100) % 100 ? n.toFixed(2) : n.toFixed(0)); const sel = () => radios.find((r) => r.checked) || radios[0]; const upd = () => { const r = sel(); if (!r) return; const q = +r.dataset.qty, d = +r.dataset.discount; now.textContent = fmt(unit * q * (1 - d / 100)); was.textContent = d ? fmt(unit * q) : ''; const lbl = add.querySelector('span') || add; lbl.textContent = (add.dataset.label || 'Add to cart') + ' — ' + now.textContent; add.dataset.label = add.dataset.label || 'Add to cart'; }; radios.forEach((r) => r.addEventListener('change', upd)); if (radios.length && !sel().checked) radios[0].checked = true; upd(); add?.addEventListener('click', () => { const r = sel(); addLines([{ id: vid, quantity: r ? +r.dataset.qty : 1, properties: r && r.dataset.label ? { Offer: r.dataset.label } : undefined }], add); }); });
  $$('[data-hero-buy]').forEach((b) => b.addEventListener('click', () => addLines([{ id: parseInt(b.dataset.vid, 10), quantity: 1 }], b)));
  $$('[data-sticky-buy]').forEach((bar) => { const after = $(bar.dataset.after || '.hero'), hide = $(bar.dataset.hide || '#offers'); let passed = false, over = false; const upd = () => bar.classList.toggle('is-on', passed && !over); if (after) new IntersectionObserver(([e]) => { passed = !e.isIntersecting && e.boundingClientRect.top < 0; upd(); }).observe(after); if (hide) new IntersectionObserver(([e]) => { over = e.isIntersecting; upd(); }, { rootMargin: '-20% 0px -20% 0px' }).observe(hide); $('[data-sticky-buy-add]', bar)?.addEventListener('click', (ev) => { const o = $('[data-offers]'); if (o) { o.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; } addLines([{ id: parseInt(bar.dataset.vid, 10), quantity: 1 }], ev.currentTarget); }); });
})();