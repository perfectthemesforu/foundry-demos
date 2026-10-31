/* Forge theme — dependency-free. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const money = (cents) => {
    const fmt = (window.theme && window.theme.moneyFormat) || '${{amount}}';
    const amt = (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fmt.replace(/\{\{\s*amount\s*\}\}/, amt).replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(cents / 100)).replace(/<[^>]+>/g, '');
  };
  const hex2rgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  /* ================= Liquid light shader ================= */
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision highp float;uniform vec2 r;uniform float t;uniform vec2 m;uniform vec3 c1;uniform vec3 c2;uniform vec3 bg;
  vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
  float snoise(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));vec3 mm=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);mm=mm*mm;mm=mm*mm;vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 ox=floor(x+.5);vec3 a0=x-ox;mm*=1.79284291400159-.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(mm,g);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*snoise(p);p=p*1.9+vec2(1.7,9.2);a*=.5;}return v;}
  void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv;p.x*=r.x/r.y;float tt=t*.06;
    vec2 mm=m;mm.x*=r.x/r.y;float md=length(p-mm);float pull=smoothstep(1.1,0.,md)*.3;
    vec2 q=vec2(fbm(p*.55+tt),fbm(p*.55-tt*.6+3.));vec2 w=vec2(fbm(p*.6+1.6*q+vec2(1.7,9.2)+tt*.4),fbm(p*.6+1.6*q+vec2(8.3,2.8)-tt*.25));
    float f=fbm(p*.5+1.8*w+pull);float g=smoothstep(-.1,.8,f);
    float sheen=pow(smoothstep(.3,1.,fbm(p*.9+w*2.+tt*.5)),4.);
    vec3 col=mix(bg,c1,g*.8);col=mix(col,c2,sheen*.55);col+=smoothstep(.7,0.,md)*.1*c2;
    float vig=smoothstep(1.35,.3,length(uv-vec2(.5,.45)));col=mix(bg,col,vig);
    col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)*.025;
    gl_FragColor=vec4(col,1.);}`;
  function liquid(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return false;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    const cs = getComputedStyle(canvas);
    gl.uniform3fv(U('c1'), hex2rgb(canvas.dataset.c1 || '#1F3BFF')); gl.uniform3fv(U('c2'), hex2rgb(canvas.dataset.c2 || '#8FB3FF')); gl.uniform3fv(U('bg'), hex2rgb(canvas.dataset.bg || '#121419'));
    let w, h, mx = .3, my = .4, tx = .3, ty = .4, running = true, raf;
    const resize = () => { const s = Math.min(devicePixelRatio, 1.5) * .6; w = canvas.width = Math.max(2, Math.floor(canvas.clientWidth * s)); h = canvas.height = Math.max(2, Math.floor(canvas.clientHeight * s)); gl.viewport(0, 0, w, h); gl.uniform2f(U('r'), w, h); };
    const t0 = performance.now();
    const frame = () => { if (!running) return; mx += (tx - mx) * .04; my += (ty - my) * .04; gl.uniform2f(U('m'), mx, my); gl.uniform1f(U('t'), (performance.now() - t0) / 1000); gl.drawArrays(gl.TRIANGLES, 0, 3); raf = requestAnimationFrame(frame); };
    resize(); addEventListener('resize', resize);
    canvas.parentElement.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width; ty = 1 - (e.clientY - r.top) / r.height; }, { passive: true });
    new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) frame(); else cancelAnimationFrame(raf); }).observe(canvas);
    if (reduced) { gl.uniform2f(U('m'), mx, my); gl.uniform1f(U('t'), 20); gl.drawArrays(gl.TRIANGLES, 0, 3); running = false; }
    else frame();
    return true;
  }
  $$('canvas[data-liquid]').forEach((c) => { const ok = liquid(c); const host = c.closest('.hero'); if (host) requestAnimationFrame(() => host.classList.add('is-ready')); if (!ok) c.remove(); });
  $$('.hero').forEach((h) => requestAnimationFrame(() => h.classList.add('is-ready')));

  /* ================= Header ================= */
  const hdr = $('.hdr');
  if (hdr) {
    const hero = $('.hero');
    const tick = () => { hdr.classList.toggle('is-stuck', scrollY > 24); hdr.classList.toggle('is-dark', !!hero && scrollY < hero.offsetHeight - 80); };
    tick(); addEventListener('scroll', tick, { passive: true });
    const btn = $('.menu-btn', hdr), nav = $('.nav', hdr);
    btn && btn.addEventListener('click', () => btn.setAttribute('aria-expanded', String(nav.classList.toggle('is-open'))));
  }

  /* ================= Reveal (section heads) ================= */
  const rio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } }), { threshold: .2 });
  $$('.reveal').forEach((el) => rio.observe(el));

  /* ================= Magnetic buttons ================= */
  if (fine && !reduced) $$('.btn').forEach((b) => {
    b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); const x = (e.clientX - r.left - r.width / 2) * .25, y = (e.clientY - r.top - r.height / 2) * .35; b.style.transform = `translate(${x}px, ${y}px)`; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });

  /* ================= Parallax (hero frame + split images) ================= */
  if (!reduced) {
    const items = $$('[data-parallax]');
    if (items.length) {
      const run = () => { items.forEach((el) => { const r = el.getBoundingClientRect(); const c = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; el.style.transform = `translateY(${(-c * parseFloat(el.dataset.parallax || 30)).toFixed(1)}px)`; }); };
      run(); addEventListener('scroll', run, { passive: true });
    }
  }

  /* ================= Before / after slider ================= */
  $$('.cmp').forEach((c) => {
    const r = $('input[type=range]', c); if (!r) return;
    const set = () => c.style.setProperty('--x', r.value + '%');
    r.addEventListener('input', set); set();
  });

  /* ================= Ingredient bars ================= */
  const iio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); iio.unobserve(e.target); } }), { threshold: .4 });
  $$('.ingr').forEach((el) => iio.observe(el));

  /* ================= Use-case tabs ================= */
  $$('[data-uses]').forEach((u) => { const tabs = $$('.uses__tab', u), figs = $$('.uses__fig img, .uses__fig .placeholder-svg', u), cap = $('[data-uses-cap]', u), caps = tabs.map((t) => t.dataset.caption || ''); const set = (i) => { tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === i))); figs.forEach((f, k) => f.classList.toggle('is-on', k === i)); }; tabs.forEach((t, i) => t.addEventListener('click', () => set(i))); set(0); });

  /* ================= Texture swatch ================= */
  $$('.swatch').forEach((w) => {
    const smear = $('.swatch__smear', w), gloss = $('.swatch__gloss', w), opts = $$('.swatch__opt', w), tones = $$('.swatch__tone button', w), panel = $('.swatch__panel', w);
    const pick = (i) => { opts.forEach((o, k) => o.setAttribute('aria-pressed', String(k === i))); smear.classList.remove('is-on'); gloss.classList.remove('is-on'); void smear.getBoundingClientRect(); smear.style.stroke = opts[i].dataset.color; smear.style.strokeOpacity = opts[i].dataset.opacity || '.9'; requestAnimationFrame(() => { smear.classList.add('is-on'); gloss.classList.add('is-on'); }); };
    opts.forEach((o, i) => o.addEventListener('click', () => pick(i)));
    tones.forEach((t) => t.addEventListener('click', () => { tones.forEach((x) => x.setAttribute('aria-pressed', 'false')); t.setAttribute('aria-pressed', 'true'); panel.style.background = `radial-gradient(90% 80% at 40% 30%, ${t.dataset.light}, ${t.dataset.dark})`; }));
    new IntersectionObserver(([e]) => { if (e.isIntersecting) { pick(0); } }, { threshold: .4 }).observe(w);
  });

  /* ================= Variant picker (swatches / options) ================= */
  $$('form[data-product-form][data-variants]').forEach((form) => {
    let variants = []; try { variants = JSON.parse($('[data-variants-json]', form).textContent); } catch (e) { return; }
    const idInput = $('[name="id"]', form), inputs = $$('input[data-option]', form);
    const sync = () => {
      const sel = {}; inputs.forEach((i) => { if (i.checked) sel[i.dataset.option] = i.value; });
      const v = variants.find((x) => Object.keys(sel).every((k) => x.options[+k] === sel[k]));
      $$('[data-sel-label]', form).forEach((l) => { l.textContent = sel[l.dataset.selLabel] || ''; });
      if (!v) return;
      idInput.value = v.id;
      $$('input[name="offer"]', form).forEach((o) => { o.dataset.price = v.price; const pct = +(o.dataset.discount || 0); o.dataset.each = Math.round(v.price * (1 - pct / 100)); });
      $$('[data-tier-total]', form).forEach((t) => { const o = $('input[name="offer"]', t.closest('.tier')); if (o) t.textContent = money(+o.dataset.each * +o.dataset.qty); });
      form.dispatchEvent(new CustomEvent('variant:change', { detail: v }));
      const btn = $('[data-atc]', form); if (btn) { btn.disabled = !v.available; if (!v.available) $('[data-atc-label]', btn).textContent = window.theme.strings.soldOut; }
      if (v.featured_image && v.featured_image.src) { const main = $('.gal__main img'); if (main) main.src = v.featured_image.src; }
      try { const u = new URL(location.href); u.searchParams.set('variant', v.id); history.replaceState(null, '', u); } catch (e) {}
    };
    inputs.forEach((i) => i.addEventListener('change', sync)); sync();
  });

  /* ================= Counters ================= */
  const cio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target, end = parseFloat(el.dataset.count), dec = (String(el.dataset.count).split('.')[1] || '').length, pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    const fmt = (v) => pre + v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suf;
    if (reduced) { el.textContent = fmt(end); return; }
    const t0 = performance.now(), d = 1500;
    const step = (t) => { const p = Math.min(1, (t - t0) / d), k = 1 - Math.pow(1 - p, 4); el.textContent = fmt(end * k); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: .5 });
  $$('[data-count]').forEach((el) => cio.observe(el));

  /* ================= Countdown ================= */
  $$('[data-countdown]').forEach((box) => {
    const root = box.closest('.deal') || box; let end;
    if (box.dataset.countdown === 'evergreen') { const hrs = parseFloat(box.dataset.hours || '24'), key = 'lumen_cd_' + (box.dataset.key || 'x'); try { end = parseInt(localStorage.getItem(key), 10); if (!end || end < Date.now()) { end = Date.now() + hrs * 36e5; localStorage.setItem(key, end); } } catch (e) { end = Date.now() + hrs * 36e5; } }
    else end = new Date(box.dataset.date).getTime();
    if (isNaN(end)) { root.classList.add('is-ended'); return; }
    const cells = { d: $('[data-d]', box), h: $('[data-h]', box), m: $('[data-m]', box), s: $('[data-s]', box) };
    const set = (el, v) => { if (!el) return; const t = String(v).padStart(2, '0'); if (el.textContent !== t) { el.textContent = t; el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); } };
    const tick = () => { let diff = Math.max(0, end - Date.now()); if (!diff) { root.classList.add('is-ended'); return; } const d = Math.floor(diff / 864e5); diff -= d * 864e5; const h = Math.floor(diff / 36e5); diff -= h * 36e5; const m = Math.floor(diff / 6e4); diff -= m * 6e4; if (cells.d) { cells.d.parentElement.hidden = d === 0; set(cells.d, d); } set(cells.h, cells.d ? h : h + d * 24); set(cells.m, m); set(cells.s, Math.floor(diff / 1e3)); setTimeout(tick, 1000); };
    tick();
  });

  /* ================= Gallery ================= */
  $$('.gal').forEach((g) => {
    const main = $('.gal__main img', g), frame = $('.gal__main', g);
    $$('.gal__thumbs button', g).forEach((b) => b.addEventListener('click', () => {
      $$('.gal__thumbs button', g).forEach((x) => x.setAttribute('aria-current', 'false')); b.setAttribute('aria-current', 'true');
      if (!main) return; frame.classList.add('is-swap'); setTimeout(() => { main.src = b.dataset.src; main.srcset = ''; main.alt = b.dataset.alt || main.alt; frame.classList.remove('is-swap'); }, 250);
    }));
  });

  /* ================= Cart ================= */
  const drawer = $('#cart-drawer');
  const R = (k, d) => (window.theme && window.theme.routes && window.theme.routes[k]) || d;
  const Cart = {
    open() { if (!drawer) return; drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; },
    close() { if (!drawer) return; drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; },
    async add(items) { const r = await fetch(R('cart_add_url', '/cart/add') + '.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items }) }); if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.description || j.message || 'Could not add to cart'); } await Cart.refresh(); Cart.open(); },
    async change(key, quantity) { await fetch(R('cart_change_url', '/cart/change') + '.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: key, quantity }) }); await Cart.refresh(); },
    async refresh() { const r = await fetch(R('cart_url', '/cart') + '.js', { headers: { Accept: 'application/json' } }); const cart = await r.json(); Cart.render(cart); return cart; },
    render(cart) {
      $$('.cart-count').forEach((c) => { c.textContent = cart.item_count; c.dataset.count = cart.item_count; });
      if (!drawer) return;
      const body = $('.drawer__body', drawer), foot = $('.drawer__foot', drawer);
      if (!cart.items.length) { body.innerHTML = `<div class="empty-state"><h3>${drawer.dataset.empty}</h3><button class="btn" data-cart-close type="button"><span>${drawer.dataset.shop}</span></button></div>`; foot.hidden = true; return; }
      foot.hidden = false;
      body.innerHTML = cart.items.map((it) => `<div class="line-item"><img src="${it.image ? it.image.replace(/(\.[a-z]+)(\?|$)/, '_160x160$1$2') : ''}" alt="" width="72" height="72" loading="lazy"><div><a class="line-item__title" href="${it.url}">${it.product_title}</a>${it.variant_title ? `<div class="small muted">${it.variant_title}</div>` : ''}<div class="qty"><button type="button" data-qty="-1" data-key="${it.key}" aria-label="−">−</button><input type="number" value="${it.quantity}" min="0" data-key="${it.key}" aria-label="Quantity"><button type="button" data-qty="1" data-key="${it.key}" aria-label="+">+</button></div></div><div style="text-align:right"><b>${money(it.final_line_price)}</b><br><button class="line-item__remove" type="button" data-remove="${it.key}">${window.theme.strings.remove}</button></div></div>`).join('');
      $('[data-subtotal]', drawer).textContent = money(cart.total_price);
      const fs = $('.free-ship', drawer);
      if (fs) { const th = parseInt(drawer.dataset.freeShip, 10); const left = th - cart.total_price; $('.free-ship__bar span', fs).style.width = Math.min(100, cart.total_price / th * 100) + '%'; $('[data-free-ship-text]', fs).textContent = left > 0 ? fs.dataset.away.replace('[amount]', money(left)) : fs.dataset.unlocked; }
    }
  };
  window.ForgeCart = Cart;
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-cart-open],[data-cart-close],[data-remove],[data-qty]'); if (!t) return;
    if (t.hasAttribute('data-cart-open')) { e.preventDefault(); Cart.refresh().then(Cart.open); }
    if (t.hasAttribute('data-cart-close')) Cart.close();
    if (t.dataset.remove) Cart.change(t.dataset.remove, 0);
    if (t.dataset.qty && drawer && drawer.contains(t)) { const input = $(`input[data-key="${t.dataset.key}"]`, drawer); Cart.change(t.dataset.key, Math.max(0, parseInt(input.value, 10) + parseInt(t.dataset.qty, 10))); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') Cart.close(); });

  /* ================= Product form ================= */
  $$('form[data-product-form]').forEach((form) => {
    const btn = $('[data-atc]', form), err = $('.form-error', form), nows = $$('[data-price-now]'), was = $('[data-price-was]'), save = $('[data-price-save]'), qtyInput = $('.qty input', form);
    $$('.qty button', form).forEach((b) => b.addEventListener('click', () => { qtyInput.value = Math.max(1, parseInt(qtyInput.value, 10) + parseInt(b.dataset.qty, 10)); }));
    const tiers = $$('input[name="offer"]', form);
    const sync = () => {
      const sel = tiers.find((o) => o.checked); if (!sel) return;
      const qty = +sel.dataset.qty, unit = +sel.dataset.price, each = +(sel.dataset.each || unit), total = each * qty, full = unit * qty;
      nows.forEach((el) => { el.textContent = money(total); });
      if (was) { was.hidden = total >= full; was.textContent = money(full); }
      if (save) { const pct = Math.round((1 - each / unit) * 100); save.hidden = pct <= 0; save.textContent = window.theme.strings.save.replace('{{ pct }}', pct); }
      if (btn) $('[data-atc-label]', btn).textContent = window.theme.strings.addToCart + ' — ' + money(total);
    };
    tiers.forEach((o) => o.addEventListener('change', sync)); form.addEventListener('variant:change', sync); if (tiers.length) sync();
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true;
      try { const id = parseInt($('[name="id"]', form).value, 10); const sel = tiers.find((o) => o.checked); const quantity = sel ? +sel.dataset.qty : parseInt(qtyInput ? qtyInput.value : 1, 10); const props = sel && sel.dataset.label ? { properties: { Offer: sel.dataset.label } } : {}; await Cart.add([{ id, quantity, ...props }]); }
      catch (ex) { err.textContent = ex.message; } finally { btn.disabled = false; }
    });
  });
  const sticky = $('.sticky'), mainBtn = $('form[data-product-form] [data-atc]');
  if (sticky && mainBtn) {
    new IntersectionObserver(([e]) => sticky.classList.toggle('is-on', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(mainBtn);
    $('[data-sticky-atc]', sticky).addEventListener('click', () => $('form[data-product-form]').requestSubmit());
  }
  if ($('.cart-count')) Cart.refresh().catch(() => {});
})();
