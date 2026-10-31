/* Extras — shared commerce layer (quick add, filters, recommendations, recently viewed, UGC lightbox, popup, upsell, bought-together, size chart, zoom, toast). */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const routes = (window.theme && window.theme.routes) || {};
  const R = (k, d) => routes[k] || d;
  const Cart = () => window.StoreCart || window.SilkCart || window.LumenCart || window.MotifCart || window.AtlasCart || window.JunoCart;
  const money = (cents) => { const fmt = (window.theme && window.theme.moneyFormat) || '${{amount}}'; const amt = (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); return fmt.replace(/\{\{\s*amount\s*\}\}/, amt).replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(cents / 100)).replace(/<[^>]+>/g, ''); };
  const toast = (msg) => { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.classList.add('is-on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('is-on'), 2200); };
  const addItems = async (items) => { const c = Cart(); if (c && c.add) return c.add(items); const r = await fetch(R('cart_add_url', '/cart/add') + '.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) }); if (!r.ok) throw new Error('Could not add'); };

  /* Quick add */
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-quick-add]'); if (!b) return; e.preventDefault();
    const id = parseInt(b.dataset.quickAdd, 10); if (!id) { location.href = b.dataset.url || '#'; return; }
    b.disabled = true; try { await addItems([{ id, quantity: 1 }]); b.classList.add('is-done'); b.textContent = b.dataset.done || 'Added'; toast(b.dataset.done || 'Added to cart'); setTimeout(() => { b.classList.remove('is-done'); b.textContent = b.dataset.label || 'Quick add'; }, 1800); } catch (ex) { toast('Could not add'); } finally { b.disabled = false; }
  });

  /* Collection filters drawer + sort */
  const fd = $('.fdrawer');
  if (fd) {
    const open = () => { fd.classList.add('is-open'); document.body.style.overflow = 'hidden'; }, close = () => { fd.classList.remove('is-open'); document.body.style.overflow = ''; };
    $$('[data-filters-open]').forEach((b) => b.addEventListener('click', open)); $$('[data-filters-close]', fd).forEach((b) => b.addEventListener('click', close));
    const form = $('form', fd); if (form) { $$('input', form).forEach((i) => i.addEventListener('change', () => { if (i.type === 'checkbox') form.requestSubmit(); })); }
  }
  const sort = $('[data-sort]'); if (sort) sort.addEventListener('change', () => { const u = new URL(location.href); u.searchParams.set('sort_by', sort.value); u.searchParams.delete('page'); location.href = u; });

  /* Recently viewed: record + render */
  try {
    const key = 'x_recent'; const list = JSON.parse(localStorage.getItem(key) || '[]');
    const h = document.body.dataset.productHandle; if (h) { const next = [h, ...list.filter((x) => x !== h)].slice(0, 8); localStorage.setItem(key, JSON.stringify(next)); }
    const host = $('[data-recent]'); if (host) {
      const handles = list.filter((x) => x !== h).slice(0, parseInt(host.dataset.recent || '4', 10));
      if (!handles.length) host.closest('section').hidden = true;
      else Promise.all(handles.map((x) => fetch(`/products/${x}.js`).then((r) => r.ok ? r.json() : null).catch(() => null))).then((ps) => { host.innerHTML = ps.filter(Boolean).map(cardHTML).join(''); });
    }
  } catch (e) {}
  function cardHTML(p) { const img = p.featured_image ? p.featured_image.replace(/(\.[a-z]+)(\?|$)/, '_600x$1$2') : ''; const v = p.variants && p.variants[0]; return `<a class="xcard" href="/products/${p.handle}"><div class="xcard__media"><img src="${img}" alt="" loading="lazy">${v && v.available ? `<div class="qa"><button class="x-btn" type="button" data-quick-add="${v.id}" data-label="Quick add" data-done="Added">Quick add</button></div>` : ''}</div><div class="xcard__title">${p.title}</div><div class="xcard__price">${money(p.price)}${p.compare_at_price > p.price ? `<s>${money(p.compare_at_price)}</s>` : ''}</div></a>`; }

  /* Recommendations via Section Rendering API */
  $$('[data-recommendations]').forEach(async (host) => {
    const sec = host.dataset.sectionId, pid = host.dataset.productId, limit = host.dataset.limit || 4; if (!sec || !pid) return;
    try { const r = await fetch(`${R('product_recommendations_url', '/recommendations/products')}?section_id=${sec}&product_id=${pid}&limit=${limit}`); const html = await r.text(); const doc = new DOMParser().parseFromString(html, 'text/html'); const inner = doc.querySelector('[data-recommendations]'); if (inner && inner.innerHTML.trim()) host.innerHTML = inner.innerHTML; else host.closest('section').hidden = true; } catch (e) { host.closest('section').hidden = true; }
  });

  /* Lightbox (UGC + gallery zoom) */
  let lb = $('.lb'); if (!lb) { lb = document.createElement('div'); lb.className = 'lb'; lb.innerHTML = '<button class="lb__x" type="button" aria-label="Close">✕</button><img alt=""><div class="lb__cap"></div>'; document.body.appendChild(lb); }
  const openLb = (src, cap) => { $('img', lb).src = src; $('.lb__cap', lb).textContent = cap || ''; lb.classList.add('is-open'); };
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb__x')) lb.classList.remove('is-open'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { lb.classList.remove('is-open'); $$('.pop.is-open,.xmodal.is-open').forEach((m) => m.classList.remove('is-open')); } });
  document.addEventListener('click', (e) => { const a = e.target.closest('[data-lightbox]'); if (!a) return; e.preventDefault(); openLb(a.dataset.lightbox || a.href, a.dataset.caption); });
  $$('.gal__main img, .gallery__main img').forEach((img) => { img.classList.add('zoomable'); img.addEventListener('click', () => openLb(img.currentSrc || img.src, img.alt)); });

  /* Newsletter popup */
  const pop = $('.pop');
  if (pop) {
    const key = 'x_pop_seen'; let shown = false;
    const show = () => { if (shown) return; try { if (sessionStorage.getItem(key)) return; } catch (e) {} shown = true; pop.classList.add('is-open'); try { sessionStorage.setItem(key, '1'); } catch (e) {} };
    const delay = parseInt(pop.dataset.delay || '12', 10) * 1000; setTimeout(show, delay);
    addEventListener('scroll', () => { if (scrollY > innerHeight * 0.6) show(); }, { passive: true });
    document.addEventListener('mouseleave', (e) => { if (e.clientY <= 0) show(); });
    $$('[data-pop-close]', pop).forEach((b) => b.addEventListener('click', () => pop.classList.remove('is-open')));
  }

  /* Cart upsell add */
  document.addEventListener('click', async (e) => { const b = e.target.closest('[data-upsell-add]'); if (!b) return; b.disabled = true; try { await addItems([{ id: parseInt(b.dataset.upsellAdd, 10), quantity: 1 }]); b.closest('.upsell').remove(); } catch (ex) { toast('Could not add'); b.disabled = false; } });

  /* Bought together */
  $$('[data-bt]').forEach((bt) => {
    const boxes = $$('input[type=checkbox]', bt), total = $('[data-bt-total]', bt), save = $('[data-bt-save]', bt), btn = $('[data-bt-add]', bt), pct = parseFloat(bt.dataset.discount || '0');
    const sync = () => { const sel = boxes.filter((b) => b.checked); const sum = sel.reduce((a, b) => a + parseInt(b.dataset.price, 10), 0); const disc = sel.length >= 2 ? Math.round(sum * pct / 100) : 0; total.textContent = money(sum - disc); if (save) { save.hidden = !disc; save.textContent = `You save ${money(disc)} (${pct}%)`; } btn.disabled = !sel.length; };
    boxes.forEach((b) => b.addEventListener('change', sync)); sync();
    btn.addEventListener('click', async () => { btn.disabled = true; try { await addItems(boxes.filter((b) => b.checked).map((b) => ({ id: parseInt(b.value, 10), quantity: 1 }))); } catch (ex) { toast('Could not add'); } finally { sync(); } });
  });

  /* Modals (size chart etc.) */
  document.addEventListener('click', (e) => { const o = e.target.closest('[data-modal-open]'); if (o) { const m = $(o.dataset.modalOpen); if (m) m.classList.add('is-open'); } const c = e.target.closest('[data-modal-close]'); if (c) c.closest('.xmodal').classList.remove('is-open'); });

  /* Tabs */
  $$('.xtabs').forEach((tabs) => { const btns = $$('button', tabs), panels = $$('.xtab', tabs.parentElement); btns.forEach((b, i) => b.addEventListener('click', () => { btns.forEach((x, k) => x.setAttribute('aria-selected', String(k === i))); panels.forEach((p, k) => p.classList.toggle('is-on', k === i)); })); });

  /* Video play */
  $$('.vid__play').forEach((b) => b.addEventListener('click', () => { const v = $('video', b.parentElement); if (v) { v.controls = true; v.play(); b.remove(); } }));
})();
