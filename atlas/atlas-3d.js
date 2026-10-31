/* Silk 3D — procedural dropper bottle, drag to rotate. No dependencies. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hex = (h) => { h = (h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  const VS = `attribute vec3 p;attribute vec3 n;attribute vec2 uv;attribute float m;uniform mat4 mv;uniform mat4 pr;uniform mat3 nm;varying vec3 vN;varying vec3 vP;varying vec2 vUv;varying float vM;
  void main(){vec4 wp=mv*vec4(p,1.);vP=wp.xyz;vN=normalize(nm*n);vUv=uv;vM=m;gl_Position=pr*wp;}`;
  const FS = `precision highp float;varying vec3 vN;varying vec3 vP;varying vec2 vUv;varying float vM;uniform sampler2D tex;uniform vec3 glass;uniform vec3 liquid;uniform vec3 capc;uniform vec3 bgc;uniform float fill;uniform vec3 ringc;uniform float isWand;
  void main(){vec3 N=normalize(vN);vec3 V=normalize(-vP);vec3 L1=normalize(vec3(-.6,.9,.8));vec3 L2=normalize(vec3(.8,.3,.4));vec3 L3=normalize(vec3(.2,-.4,-1.));
    float fr=pow(1.-max(dot(N,V),0.),3.);
    vec3 base;float rough;
    if(vM<.5){vec4 t=texture2D(tex,vUv);float below=smoothstep(fill+.02,fill-.02,vUv.y);base=mix(glass,liquid,below*.55);base=mix(base,t.rgb,t.a);rough=mix(.35,.7,t.a);}
    else if(vM<1.5){base=isWand>.5?ringc:capc;rough=.18;}
    else if(vM<2.5){base=mix(glass,vec3(1.),.3);rough=.3;}
    else{base=vec3(.78,.79,.82);rough=.06;}
    float d=max(dot(N,L1),0.)*.75+max(dot(N,L2),0.)*.35+max(dot(N,L3),0.)*.15;
    vec3 H1=normalize(L1+V),H2=normalize(L2+V);float sp=pow(max(dot(N,H1),0.),mix(220.,18.,rough))*(1.-rough)*1.1+pow(max(dot(N,H2),0.),mix(120.,12.,rough))*(1.-rough)*.5;
    vec3 R=reflect(-V,N);float env=smoothstep(-.4,1.,R.y)*.35+.65; if(vM>2.5){env=mix(.5,1.3,smoothstep(-.6,.9,R.y));}
    vec3 col=base*(0.72+d*.5)*env+vec3(sp)+fr*mix(bgc,vec3(1.),.6)*(vM<.5?.55:.25);
    if(vM<.5){col=mix(col,bgc,fr*.08);} if(vM>2.5){col+=fr*.35;} if(isWand>.5&&vM<.5){col*=1.14;}
    gl_FragColor=vec4(col,1.);}`;

  function lathe(profile, segs, mat, uvFront) {
    const P = [], N = [], UV = [], M = [], I = [];
    const n = profile.length;
    const ys = profile.map((q) => q[1]), ymin = Math.min(...ys), ymax = Math.max(...ys);
    // tangents for normals
    for (let i = 0; i < n; i++) {
      const [r, y] = profile[i];
      const p0 = profile[Math.max(0, i - 1)], p1 = profile[Math.min(n - 1, i + 1)];
      let tr = p1[0] - p0[0], ty = p1[1] - p0[1]; const tl = Math.hypot(tr, ty) || 1; tr /= tl; ty /= tl;
      const nr = ty, ny = -tr; // outward normal in (r,y) plane
      for (let j = 0; j <= segs; j++) {
        const th = j / segs * Math.PI * 2, s = Math.sin(th), c = Math.cos(th);
        P.push(r * s, y, r * c);
        N.push(nr * s, ny, nr * c);
        UV.push(((th / (Math.PI * 2)) + .5) % 1, (y - ymin) / (ymax - ymin || 1));
        M.push(mat);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j, b = a + segs + 1;
      I.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return { P, N, UV, M, I };
  }
  function merge(parts) {
    const out = { P: [], N: [], UV: [], M: [], I: [] }; let off = 0;
    parts.forEach((g) => { out.P.push(...g.P); out.N.push(...g.N); out.UV.push(...g.UV); out.M.push(...g.M); g.I.forEach((i) => out.I.push(i + off)); off += g.P.length / 3; });
    return out;
  }
  // rounded profile helper: arc from (r0,y0) to (r1,y1) with steps
  const arc = (cx, cy, rad, a0, a1, steps) => { const o = []; for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * i / steps; o.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]); } return o; };

  function buildBottle() {
    const R = .44, H = .98, cr = .1; // body radius, half height, corner radius
    const body = [[0, -H], ...arc(R - cr, -H + cr, cr, -Math.PI / 2, 0, 6), [R, H - .32], ...arc(R - .16, H - .32, .16, 0, Math.PI / 2 - .35, 6), [.22, H + .02], [.2, H + .06]];
    const collar = [[.19, H + .02], [.24, H + .05], [.24, H + .38], [.21, H + .42], [.18, H + .42]];
    const bulb = [[.17, H + .4], [.2, H + .5], [.21, H + .64], ...arc(0, H + .64, .21, 0, Math.PI / 2, 8).slice(1)];
    const pip = [[0, -H + .12], [.03, -H + .12], [.03, H + .4], [0, H + .4]];
    return merge([lathe(body, 72, 0), lathe(collar, 48, 1), lathe(bulb, 48, 1), lathe(pip, 12, 2)]);
  }

  function buildWand() {
    const R = .2, y0 = -1.15, y1 = .5; // handle
    const handle = [[0, y0], ...arc(R - .09, y0 + .09, .09, -Math.PI / 2, 0, 5), [R, y1 - .1], ...arc(R - .06, y1 - .1, .06, 0, Math.PI / 2, 4), [0, y1]];
    const ring = [[R + .005, y1 - .2], [R + .022, y1 - .18], [R + .022, y1 - .02], [R + .005, y1]];
    const tip = []; const ty0 = y1 - .02, h = .95;
    for (let i = 0; i <= 24; i++) { const t = i / 24; const e = Math.sqrt(Math.max(0, 1 - Math.pow((t - .42) / .58, 2))); let r = .31 * e * (1 - .25 * t); if (t < .12) r = Math.max(r, .13); if (i === 24) r = 0; tip.push([r, ty0 + h * t]); }
    return merge([lathe(handle, 56, 0), lathe(ring, 56, 1), lathe(tip, 64, 3)]);
  }

  function buildFlask() {
    const R = .36, y0 = -1.2, yS = .55, yN = .78, yC = 1.05; // body, shoulder, neck, cap top
    const body = [[0, y0], ...arc(R - .07, y0 + .07, .07, -Math.PI / 2, 0, 5), [R, yS - .2], ...arc(R - .14, yS - .2, .14, 0, Math.PI / 2 - .5, 5), [.24, yN - .02], [.24, yN]];
    const lip = [[.235, yN - .01], [.25, yN], [.25, yN + .08], [.235, yN + .09]];
    const cap = [[.2, yN + .06], [.27, yN + .09], [.28, yC - .06], ...arc(.22, yC - .06, .06, 0, Math.PI / 2, 4), [0, yC]];
    const loop = [[.05, yC - .01], [.07, yC + .02], [.07, yC + .12], [.05, yC + .14], [0, yC + .14]];
    return merge([lathe(body, 72, 0), lathe(lip, 48, 3), lathe(cap, 56, 1), lathe(loop, 24, 1)]);
  }
  function flaskTexture(opts) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const x = c.getContext('2d'); x.clearRect(0, 0, 1024, 1024);
    x.fillStyle = opts.text; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '800 54px "Inter Display", Inter, system-ui, sans-serif'; x.letterSpacing = '2px'; x.fillText(opts.brand.toUpperCase(), 512, 1024 * .52);
    x.font = '500 20px Inter, system-ui, sans-serif'; x.letterSpacing = '3px'; x.globalAlpha = .75; x.fillText(opts.sub.toUpperCase(), 512, 1024 * .52 + 48); x.globalAlpha = 1;
    x.fillRect(512 - 70, 1024 * .52 - 48, 140, 3);
    return c;
  }
  function wandTexture(opts) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const x = c.getContext('2d'); x.clearRect(0, 0, 1024, 1024);
    x.save(); x.translate(512, 1024 * .62); x.rotate(-Math.PI / 2); x.fillStyle = opts.label; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '500 22px Lora, Georgia, serif'; x.letterSpacing = '8px'; x.fillText(opts.brand.toUpperCase(), 0, 0); x.restore();
    // buttons (front)
    x.fillStyle = opts.cap || '#1A1416'; [[512, 1024 * .45], [512, 1024 * .50]].forEach(([bx, by]) => { x.beginPath(); x.arc(bx, by, 9, 0, Math.PI * 2); x.fill(); });
    return c;
  }
  function labelTexture(opts) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const x = c.getContext('2d');
    x.clearRect(0, 0, 1024, 1024);
    // label band: v from 0.30 to 0.60 of body profile (v=1 top). canvas y = (1-v)*1024
    const y0 = (1 - .62) * 1024, y1 = (1 - .30) * 1024;
    const g = x.createLinearGradient(0, 0, 1024, 0); g.addColorStop(0, opts.label); g.addColorStop(.5, opts.label2 || opts.label); g.addColorStop(1, opts.label);
    x.fillStyle = g; x.fillRect(0, y0, 1024, y1 - y0);
    x.fillStyle = opts.text; x.textAlign = 'center'; x.textBaseline = 'middle';
    const cx = 512, mid = (y0 + y1) / 2;
    x.font = '500 26px Lora, Georgia, serif'; x.letterSpacing = '8px'; x.fillText(opts.brand.toUpperCase(), cx + 4, mid - 92);
    x.fillRect(cx - 70, mid - 64, 140, 1.5);
    x.font = '500 48px Lora, Georgia, serif'; x.letterSpacing = '0px'; x.fillText(opts.name, cx, mid - 12);
    x.font = '500 13px Inter, system-ui, sans-serif'; x.letterSpacing = '1.5px'; x.globalAlpha = .85; x.fillText(opts.sub.toUpperCase(), cx + 1, mid + 40);
    x.font = '400 13px Inter, system-ui, sans-serif'; x.globalAlpha = .7; x.fillText(opts.size, cx, mid + 82); x.globalAlpha = 1;
    return c;
  }

  function mat4Persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]; }
  function mv(yaw, pitch, z, s) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // R = Rx(pitch) * Ry(yaw), scaled, translated
    return [s * cy, 0, -s * sy, 0, s * sy * sp, s * cp, s * cy * sp, 0, s * sy * cp, -s * sp, s * cy * cp, 0, 0, -0.05, z, 1];
  }

  function init(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }); if (!gl) return null;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); } return o; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
    const shape = canvas.dataset.shape || 'bottle'; const G = shape === 'wand' ? buildWand() : shape === 'flask' ? buildFlask() : buildBottle();
    const buf = (name, data, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); };
    buf('p', G.P, 3); buf('n', G.N, 3); buf('uv', G.UV, 2); buf('m', G.M, 1);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(G.I), gl.STATIC_DRAW);
    const U = (n) => gl.getUniformLocation(prog, n);
    const d = canvas.dataset;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const upload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, (shape === 'wand' ? wandTexture : shape === 'flask' ? flaskTexture : labelTexture)({ cap: d.cap, label: d.label || '#7A1F2E', label2: d.label2 || '#8A2A3A', text: d.text || '#F5ECEA', brand: d.brand || 'Brand', name: d.name || 'The Serum', sub: d.sub || 'Niacinamide 5% · Hyaluronic 2%', size: d.size || '30 ml  e  1 fl oz' })); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); };
    upload(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(upload);
    gl.uniform1i(U('tex'), 0);
    gl.uniform3fv(U('glass'), hex(d.glass || '#EFDAD3')); gl.uniform3fv(U('liquid'), hex(d.fluid || '#F3DCD4')); gl.uniform3fv(U('capc'), hex(d.cap || '#1A1416')); gl.uniform3fv(U('bgc'), hex(d.bg || '#F5ECEA'));
    gl.uniform1f(U('fill'), parseFloat(d.fill || (shape === 'bottle' ? '0.62' : '-1'))); gl.uniform3fv(U('ringc'), hex(d.label || '#7A1F2E')); gl.uniform1f(U('isWand'), shape === 'wand' ? 1 : 0);
    gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
    let w, h; const resize = () => { const s = Math.min(devicePixelRatio || 1, 2); w = canvas.width = Math.max(2, canvas.clientWidth * s | 0); h = canvas.height = Math.max(2, canvas.clientHeight * s | 0); gl.viewport(0, 0, w, h); gl.uniformMatrix4fv(U('pr'), false, mat4Persp(.6, w / h, .1, 20)); };
    resize(); addEventListener('resize', resize);
    const st = { yaw: -.35, pitch: .06, vy: 0, vp: 0, drag: false, lx: 0, ly: 0, t: 0, idle: 0, running: true, scale: parseFloat(d.scale || '0.86') };
    const draw = () => {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const M = mv(st.yaw, st.pitch, -4.6, st.scale); gl.uniformMatrix4fv(U('mv'), false, M);
      // normal matrix = rotation part (uniform scale → same)
      const nm = [M[0] / st.scale, M[1] / st.scale, M[2] / st.scale, M[4] / st.scale, M[5] / st.scale, M[6] / st.scale, M[8] / st.scale, M[9] / st.scale, M[10] / st.scale];
      gl.uniformMatrix3fv(U('nm'), false, nm);
      gl.drawElements(gl.TRIANGLES, G.I.length, gl.UNSIGNED_SHORT, 0);
    };
    const tick = () => {
      if (!st.running) return;
      if (!st.drag) { st.idle += .016; st.yaw += st.vy; st.pitch += st.vp; st.vy *= .94; st.vp *= .9; const restY = -.35 + Math.sin(st.idle * .6) * .12, restP = .06 + Math.sin(st.idle * .45) * .03; st.yaw += (restY - st.yaw) * .02; st.pitch += (restP - st.pitch) * .04; }
      draw(); requestAnimationFrame(tick);
    };
    canvas.addEventListener('pointerdown', (e) => { st.drag = true; st.lx = e.clientX; st.ly = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-dragging'); });
    canvas.addEventListener('pointermove', (e) => { if (!st.drag) return; const dx = e.clientX - st.lx, dy = e.clientY - st.ly; st.lx = e.clientX; st.ly = e.clientY; st.vy = dx * .006; st.vp = dy * .003; st.yaw += st.vy; st.pitch = Math.max(-.5, Math.min(.5, st.pitch + st.vp)); });
    const up = () => { st.drag = false; canvas.classList.remove('is-dragging'); };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    new IntersectionObserver(([e]) => { st.running = e.isIntersecting; if (st.running) tick(); }).observe(canvas);
    if (reduced) { draw(); st.running = false; } else tick();
    return { redraw: draw, set: (o) => Object.assign(st, o) };
  }
  window.Silk3D = { init };
  document.querySelectorAll('canvas[data-bottle]').forEach((c) => { const api = init(c); if (!api) c.remove(); else c.closest('.hero') && c.closest('.hero').classList.add('has-3d'); });
})();
