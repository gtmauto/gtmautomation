/*!
 * immersive.js — GTM Automation "Inbox Constellation" (2026-10-10)
 * One original WebGL scene, no libraries: customer messages stream in from four channel portals
 * (Messenger, WhatsApp, Instagram, Telegram) into "your page" (the hero inbox card) and the AI's
 * answers fly back out in warm gold. Home hero = full scene; other pages = a quieter ambient field.
 * Progressive enhancement only: no WebGL, reduced motion, Save-Data or a lost context → the page
 * keeps its existing design. All content, links and forms stay plain HTML.
 */
(function () {
  'use strict';
  var doc = document, win = window, root = doc.documentElement;
  var mq = function (q) { return !!(win.matchMedia && win.matchMedia(q).matches); };
  var REDUCE = mq('(prefers-reduced-motion: reduce)');
  var FINE = mq('(pointer: fine)');
  var conn = navigator.connection || {};
  var SAVE = conn.saveData === true;
  var small = Math.min(win.innerWidth, win.innerHeight) < 700;
  var TIER = (small || (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 3) ? 1 : 2;
  if (!REDUCE) root.classList.add('imm-on');

  /* ------------------------------------------------------------------ card tilt (desktop pointers) */
  function initTilt() {
    if (REDUCE || !FINE) return;
    var sel = '[data-tilt], #proof .glass, #features .glass, #how .glass, #pricing .glass, #compare .glass, #inbound .glass, #cost .glass, main .glass';
    var els = doc.querySelectorAll(sel);
    Array.prototype.forEach.call(els, function (el) {
      if (el.querySelector('input, textarea, select, canvas, iframe, #chat-demo, form') || el.closest('#hero, #live-demo, #lead-form, #calculator')) return;
      el.classList.add('imm-tilt');
      var raf = 0, rx = 0, ry = 0;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        rx = -py * 6; ry = px * 7;
        el.style.setProperty('--imm-mx', ((px + 0.5) * 100).toFixed(1) + '%');
        el.style.setProperty('--imm-my', ((py + 0.5) * 100).toFixed(1) + '%');
        if (!raf) raf = requestAnimationFrame(function () { raf = 0; el.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateZ(0)'; });
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ------------------------------------------------------------------ tiny matrix helpers */
  function persp(fov, asp, n, f) {
    var t = 1 / Math.tan(fov / 2), nf = 1 / (n - f);
    return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0];
  }
  function lookAt(e, c, u) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    var xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  }
  function mul(a, b) {
    var o = new Array(16);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
      o[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
    }
    return o;
  }
  function xform(m, p) { // → clip
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14], m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]];
  }

  /* ------------------------------------------------------------------ shaders */
  var VS_MSG = [
    'attribute vec4 aA; attribute vec2 aB;',
    'uniform mat4 uPV; uniform vec2 uCenter; uniform float uTime, uPx, uBurst;',
    'uniform vec3 uP0, uP1, uP2, uP3, uC0, uC1, uC2, uC3, uGold; uniform vec3 uR;',
    'varying vec3 vCol; varying float vA;',
    'vec3 por(float i){ return i<0.5?uP0:(i<1.5?uP1:(i<2.5?uP2:uP3)); }',
    'vec3 col(float i){ return i<0.5?uC0:(i<1.5?uC1:(i<2.5?uC2:uC3)); }',
    'void main(){',
    '  float t = fract(aA.y + uTime * aA.w);',
    '  vec3 P = por(aA.x); vec3 side = normalize(vec3(-P.y, P.x, 0.0) + 1e-4);',
    '  vec3 pos; vec3 c; float a; float sz = aB.x;',
    '  if (t < 0.56) { float s = t / 0.56; float e = s * s * (3.0 - 2.0 * s);',
    '    pos = mix(P, vec3(0.0), e) + side * sin(e * 3.14159) * aA.z * uR.x * 0.30;',
    '    pos.z += sin(e * 3.14159) * aB.y * uR.x * 0.25;',
    '    c = col(aA.x); a = smoothstep(0.0, 0.10, s) * (1.0 - 0.75 * smoothstep(0.80, 1.0, s));',
    '  } else { float s = (t - 0.56) / 0.44; float e = 1.0 - (1.0 - s) * (1.0 - s);',
    '    pos = mix(vec3(0.0), P * 1.28, e) - side * sin(e * 3.14159) * aA.z * uR.x * 0.26;',
    '    pos.z += sin(e * 3.14159) * uR.x * (0.55 + 0.35 * aB.y);',
    '    c = mix(uGold, col(aA.x), 0.22); a = smoothstep(0.0, 0.12, s) * (1.0 - smoothstep(0.78, 1.0, s)) * (0.85 + 0.9 * uBurst); sz *= 1.25 + uBurst;',
    '  }',
    '  vec4 cp = uPV * vec4(pos, 1.0); cp.xy += uCenter * cp.w; gl_Position = cp;',
    '  gl_PointSize = clamp(sz * uPx / cp.w, 1.0, 64.0); vCol = c; vA = a;',
    '}'].join('\n');
  var FS_DOT = [
    'precision mediump float; varying vec3 vCol; varying float vA;',
    'void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;',
    '  float m = smoothstep(0.5, 0.0, r); float k = smoothstep(0.16, 0.0, r);',
    '  gl_FragColor = vec4(vCol * (0.75 * m + 0.9 * k), 1.0) * (m * vA); }'].join('\n');
  var VS_STAR = [
    'attribute vec4 aS; uniform mat4 uPV; uniform vec2 uCenter; uniform float uTime, uPx; varying vec3 vCol; varying float vA;',
    'void main(){ vec4 cp = uPV * vec4(aS.xyz, 1.0); cp.xy += uCenter * cp.w; gl_Position = cp;',
    '  gl_PointSize = clamp(1.6 * uPx / cp.w, 1.0, 3.0); vCol = vec3(0.75, 0.85, 1.0); vA = 0.25 + 0.35 * (0.5 + 0.5 * sin(uTime * (0.6 + aS.w) + aS.w * 40.0)); }'].join('\n');
  var VS_LINE = [
    'attribute vec3 aP; attribute float aK; uniform mat4 uPV, uM; uniform vec2 uCenter; uniform vec4 uGlow; uniform vec3 uC0, uC1, uC2, uC3, uCore;',
    'varying vec3 vCol; varying float vA;',
    'void main(){ vec4 w = aK < 0.0 ? uM * vec4(aP, 1.0) : vec4(aP, 1.0); vec4 cp = uPV * w; cp.xy += uCenter * cp.w; gl_Position = cp;',
    '  if (aK < 0.0) { vCol = uCore; vA = 0.55; }',
    '  else { float g = aK < 0.5 ? uGlow.x : (aK < 1.5 ? uGlow.y : (aK < 2.5 ? uGlow.z : uGlow.w));',
    '    vCol = aK < 0.5 ? uC0 : (aK < 1.5 ? uC1 : (aK < 2.5 ? uC2 : uC3)); vA = 0.45 + 0.55 * g; } }'].join('\n');
  var FS_LINE = 'precision mediump float; varying vec3 vCol; varying float vA; void main(){ gl_FragColor = vec4(vCol * vA, vA); }';
  var VS_GLOW = 'attribute vec2 aQ; uniform vec2 uPos; uniform vec2 uSize; varying vec2 vQ; void main(){ vQ = aQ; gl_Position = vec4(uPos + aQ * uSize, 0.0, 1.0); }';
  var FS_GLOW = [
    'precision mediump float; varying vec2 vQ; uniform float uPulse;',
    'void main(){ float r = length(vQ); if (r > 1.0) discard; float a = pow(1.0 - r, 2.2) * (0.42 + 0.25 * uPulse);',
    '  vec3 c = mix(vec3(0.49, 0.36, 0.98), vec3(0.13, 0.83, 0.93), smoothstep(0.0, 0.7, r)); gl_FragColor = vec4(c * a, a); }'].join('\n');

  function compile(gl, vs, fs) {
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
    return { p: p, u: u };
  }
  function buffer(gl, data) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; }
  function attr(gl, prog, name, buf, size, stride, off) {
    var loc = gl.getAttribLocation(prog.p, name); if (loc < 0) return -1;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride || 0, off || 0); return loc;
  }
  var hex = function (h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; };
  var CHANNELS = [
    { name: 'Messenger', color: '#2f8cff', href: 'https://m.me/gtmautomation', label: 'Messenger-এ বট টেস্ট করুন' },
    { name: 'WhatsApp', color: '#25d366', href: 'https://wa.me/8801886723675', label: 'WhatsApp-এ বট টেস্ট করুন' },
    { name: 'Instagram', color: '#ff4f9a', href: 'https://instagram.com/gtmautomationbd', label: 'Instagram-এ বট টেস্ট করুন' },
    { name: 'Telegram', color: '#38c8ff', href: 'https://t.me/GTM_Autobot', label: 'Telegram-এ বট টেস্ট করুন' },
  ];
  var ANG = [Math.PI * 0.80, Math.PI * 0.20, Math.PI * 1.20, Math.PI * 1.80];

  /* ------------------------------------------------------------------ the scene */
  function mountScene(host, mode) {
    if (SAVE) return null;
    var hero = mode === 'hero';
    var canvas = doc.createElement('canvas');
    canvas.className = 'imm-canvas' + (hero ? ' imm-canvas-hero' : ' imm-canvas-ambient');
    canvas.setAttribute('aria-hidden', 'true');
    var gl;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: TIER > 1, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: TIER > 1 ? 'high-performance' : 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return null;
    var P;
    try {
      P = { msg: compile(gl, VS_MSG, FS_DOT), star: compile(gl, VS_STAR, FS_DOT), line: compile(gl, VS_LINE, FS_LINE), glow: compile(gl, VS_GLOW, FS_GLOW) };
    } catch (e) { return null; }
    host.classList.add('imm-host');
    host.insertBefore(canvas, host.firstChild);

    /* geometry */
    var MAXN = hero ? (TIER > 1 ? 1600 : 700) : (TIER > 1 ? 520 : 240);
    var n = MAXN;
    var A = new Float32Array(MAXN * 4), B = new Float32Array(MAXN * 2);
    for (var i = 0; i < MAXN; i++) {
      A[i * 4] = i % 4; A[i * 4 + 1] = Math.random(); A[i * 4 + 2] = Math.random() * 2 - 1; A[i * 4 + 3] = (hero ? 0.045 : 0.025) * (0.6 + Math.random() * 0.8);
      B[i * 2] = (hero ? (TIER > 1 ? 0.046 : 0.040) : 0.028) * (0.5 + Math.random()); B[i * 2 + 1] = Math.random() * 2 - 1;
    }
    var bA = buffer(gl, A), bB = buffer(gl, B);
    var NS = TIER > 1 ? 420 : 200, S = new Float32Array(NS * 4);
    for (var s = 0; s < NS; s++) {
      var th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1), rr = 7 + Math.random() * 6;
      S[s * 4] = rr * Math.sin(ph) * Math.cos(th); S[s * 4 + 1] = rr * Math.sin(ph) * Math.sin(th) * 0.6; S[s * 4 + 2] = -Math.abs(rr * Math.cos(ph)) - 1; S[s * 4 + 3] = Math.random();
    }
    var bS = buffer(gl, S);
    var bQ = buffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    // icosahedron (unit) edges, kind -1
    var g = (1 + Math.sqrt(5)) / 2, V = [[-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1]];
    var edges = [];
    for (var a1 = 0; a1 < 12; a1++) for (var a2 = a1 + 1; a2 < 12; a2++) {
      var dx = V[a1][0] - V[a2][0], dy = V[a1][1] - V[a2][1], dz = V[a1][2] - V[a2][2];
      if (Math.abs(Math.hypot(dx, dy, dz) - 2) < 0.01) edges.push(V[a1], V[a2]);
    }
    var lineData = [], coreCount = edges.length;
    edges.forEach(function (v) { var k = 1 / Math.hypot(v[0], v[1], v[2]); lineData.push(v[0] * k, v[1] * k, v[2] * k, -1); });
    var ringStart = lineData.length / 4, SEG = 40;
    var bL = gl.createBuffer();

    /* state */
    var W = 1, H = 1, dpr = 1, R = [1, 1], center = [0, 0], portals = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    var FOV = 0.70, DIST = 6, yaw = 0, yawV = 0, pitch = 0, tx = 0, ty = 0, px = 0, py = 0, burst = 0, glowT = [0, 0, 0, 0], glow = [0, 0, 0, 0];
    var running = false, paused = REDUCE, visible = true, raf = 0, t0 = performance.now(), simT = REDUCE ? 14.2 : 0, last = 0, scrollP = 0;
    var frames = 0, slowAcc = 0, quality = 1;
    var hots = [];

    function layout() {
      var r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      var cap = TIER > 1 ? 1.75 : 1.3;
      dpr = Math.min(win.devicePixelRatio || 1, cap) * quality;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      var wpp = 2 * DIST * Math.tan(FOV / 2) / H; // world units per CSS px at z=0
      var cx = W * (win.innerWidth >= 1024 ? 0.74 : 0.5), cy = H * (hero ? 0.5 : 0.42), cw = W * 0.35, ch = H * 0.5;
      var card = hero ? doc.getElementById('chat-demo') : null;
      card = card && card.closest('.glass');
      if (card) { var cr = card.getBoundingClientRect(); cx = cr.left - r.left + cr.width / 2; cy = cr.top - r.top + cr.height / 2; cw = cr.width; ch = cr.height; }
      center = [(cx / W) * 2 - 1, 1 - (cy / H) * 2];
      var wide = win.innerWidth >= 1024;
      /* wide: portals sit just outside the card edges (dots; labels on hover/focus) and stay clear of the fixed channel buttons */
      R = hero ? (wide ? [Math.min((cw / 2 + 12) / 0.809, (W - cx - 150) / 0.809) * wpp, Math.max((ch / 2 - 24) / 0.588, 120) * wpp] : [Math.max(cw * 0.56, 120) * wpp, Math.max(ch * 0.60, 150) * wpp]) : [W * (win.innerWidth >= 1024 ? 0.22 : 0.42) * wpp, H * 0.36 * wpp];
      for (var k = 0; k < 4; k++) portals[k] = [R[0] * Math.cos(ANG[k]), R[1] * Math.sin(ANG[k]), R[0] * 0.18 * Math.cos(ANG[k] * 2)];
      // portal rings (radius scales with R)
      var data = lineData.slice(0, ringStart * 4), pr = Math.min(R[0], R[1]) * (hero ? 0.13 : 0.08);
      for (var q = 0; q < 4; q++) for (var j = 0; j < SEG; j++) {
        var a0 = j / SEG * Math.PI * 2, b0 = (j + 1) / SEG * Math.PI * 2, p = portals[q];
        data.push(p[0] + pr * Math.cos(a0), p[1] + pr * Math.sin(a0), p[2], q, p[0] + pr * Math.cos(b0), p[1] + pr * Math.sin(b0), p[2], q);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, bL); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      if (!running || paused) draw(simT);
    }

    function matrices() {
      var cy2 = Math.cos(pitch), e = [DIST * Math.sin(yaw) * cy2, DIST * Math.sin(pitch), DIST * Math.cos(yaw) * cy2];
      return mul(persp(FOV, W / H, 0.1, 60), lookAt(e, [0, 0, 0], [0, 1, 0]));
    }
    function setVec(u, v) { gl.uniform3f(u, v[0], v[1], v[2]); }
    var COL = CHANNELS.map(function (c) { return hex(c.color); }), GOLD = hex('#fbbf24');

    function draw(time) {
      var pv = matrices();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      var pxs = H * dpr / (2 * Math.tan(FOV / 2)); // CSS-px-per-world-unit at depth 1, in device px

      // stars
      gl.useProgram(P.star.p);
      gl.uniformMatrix4fv(P.star.u.uPV, false, pv); gl.uniform2f(P.star.u.uCenter, center[0], center[1]);
      gl.uniform1f(P.star.u.uTime, time); gl.uniform1f(P.star.u.uPx, pxs * 0.01);
      var la = attr(gl, P.star, 'aS', bS, 4);
      gl.drawArrays(gl.POINTS, 0, NS); gl.disableVertexAttribArray(la);

      // core glow (screen-space billboard at the projected origin)
      var c0 = xform(pv, [0, 0, 0]);
      gl.useProgram(P.glow.p);
      gl.uniform2f(P.glow.u.uPos, c0[0] / c0[3] + center[0], c0[1] / c0[3] + center[1]);
      var gs = Math.min(R[0], R[1]) * 0.55 / (DIST * Math.tan(FOV / 2));
      gl.uniform2f(P.glow.u.uSize, gs * H / W, gs);
      gl.uniform1f(P.glow.u.uPulse, 0.5 + 0.5 * Math.sin(time * 1.7) + burst);
      var lq = attr(gl, P.glow, 'aQ', bQ, 2);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(lq);

      // core wireframe + portal rings
      gl.useProgram(P.line.p);
      var rc = Math.min(R[0], R[1]) * (hero ? 0.30 : 0.18), ca = Math.cos(time * 0.35), sa = Math.sin(time * 0.35), cb = Math.cos(time * 0.21), sb = Math.sin(time * 0.21);
      var M = [rc * ca, 0, -rc * sa, 0, rc * sa * sb, rc * cb, rc * ca * sb, 0, rc * sa * cb, -rc * sb, rc * ca * cb, 0, 0, 0, -0.15, 1]; // Ry(a)·Rx(b)·scale, column-major
      gl.uniformMatrix4fv(P.line.u.uPV, false, pv); gl.uniformMatrix4fv(P.line.u.uM, false, M);
      gl.uniform2f(P.line.u.uCenter, center[0], center[1]);
      gl.uniform4f(P.line.u.uGlow, glow[0], glow[1], glow[2], glow[3]);
      setVec(P.line.u.uC0, COL[0]); setVec(P.line.u.uC1, COL[1]); setVec(P.line.u.uC2, COL[2]); setVec(P.line.u.uC3, COL[3]);
      gl.uniform3f(P.line.u.uCore, 0.45 + 0.2 * burst, 0.62, 1.0);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      var l1 = attr(gl, P.line, 'aP', bL, 3, 16, 0), l2 = attr(gl, P.line, 'aK', bL, 1, 16, 12);
      gl.drawArrays(gl.LINES, 0, coreCount + (hero ? 4 * SEG * 2 : 0));
      gl.disableVertexAttribArray(l1); if (l2 >= 0) gl.disableVertexAttribArray(l2);

      // messages
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(P.msg.p);
      var u = P.msg.u;
      gl.uniformMatrix4fv(u.uPV, false, pv); gl.uniform2f(u.uCenter, center[0], center[1]);
      gl.uniform1f(u.uTime, time); gl.uniform1f(u.uPx, pxs); gl.uniform1f(u.uBurst, burst);
      setVec(u.uP0, portals[0]); setVec(u.uP1, portals[1]); setVec(u.uP2, portals[2]); setVec(u.uP3, portals[3]);
      setVec(u.uC0, COL[0]); setVec(u.uC1, COL[1]); setVec(u.uC2, COL[2]); setVec(u.uC3, COL[3]); setVec(u.uGold, GOLD);
      gl.uniform3f(u.uR, Math.min(R[0], R[1]), 0, 0);
      var m1 = attr(gl, P.msg, 'aA', bA, 4), m2 = attr(gl, P.msg, 'aB', bB, 2);
      gl.drawArrays(gl.POINTS, 0, n);
      gl.disableVertexAttribArray(m1); gl.disableVertexAttribArray(m2);

      // hotspots follow their portals
      if (hots.length) {
        for (var k = 0; k < 4; k++) {
          var cp = xform(pv, portals[k]);
          var sx = ((cp[0] / cp[3] + center[0]) * 0.5 + 0.5) * W, sy = (1 - (cp[1] / cp[3] + center[1]) * 0.5 - 0.5) * H;
          hots[k].style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0) translate(-50%,-50%)';
        }
      }
    }

    function frame(now) {
      raf = 0;
      if (!running || paused) return;
      var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      // adaptive quality: first ~90 frames decide
      if (frames < 90) { frames++; if (dt > 0.024) slowAcc++; if (frames === 90 && slowAcc > 45 && (n > MAXN / 3 || quality > 0.7)) { n = Math.round(n * 0.55); quality = 0.75; layout(); } }
      simT += dt * (1 + burst * 1.5 + scrollP * 0.6);
      burst *= Math.pow(0.25, dt);
      yaw += yawV * dt; yawV *= Math.pow(0.12, dt);
      px += (tx - px) * Math.min(1, dt * 3); py += (ty - py) * Math.min(1, dt * 3);
      var targetPitch = py + scrollP * 0.45;
      pitch += (targetPitch - pitch) * Math.min(1, dt * 4);
      for (var k = 0; k < 4; k++) glow[k] += (glowT[k] - glow[k]) * Math.min(1, dt * 6);
      var keepYaw = yaw; yaw = keepYaw + px; draw(simT); yaw = keepYaw;
      raf = requestAnimationFrame(frame);
    }
    function start() { if (running || paused || !visible) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

    /* interaction (hero host only listens; content stays clickable) */
    var interactive = function (el) { return !!(el && el.closest && el.closest('a, button, input, textarea, select, label, .glass, [role=button]')); };
    var drag = null;
    if (!REDUCE) {
      host.addEventListener('pointermove', function (e) {
        var r = host.getBoundingClientRect();
        /* parallax freezes over a hotspot so the link never slides away from the cursor */
        if (e.pointerType === 'mouse' && !(e.target && e.target.closest && e.target.closest('.imm-hot'))) { tx = ((e.clientX - r.left) / r.width - 0.5) * 0.16; ty = ((e.clientY - r.top) / r.height - 0.5) * 0.09; }
        if (drag && e.pointerId === drag.id) { var d = e.clientX - drag.x; drag.x = e.clientX; drag.moved += Math.abs(d); yaw += d * 0.0045; yawV = d * 0.0045 / 0.016; }
      }, { passive: true });
      host.addEventListener('pointerdown', function (e) { if (interactive(e.target)) return; drag = { id: e.pointerId, x: e.clientX, moved: 0 }; }, { passive: true });
      var end = function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (drag.moved < 6 && hero && e.type === 'pointerup') { burst = Math.min(1.6, burst + 1); }
        drag = null;
      };
      host.addEventListener('pointerup', end, { passive: true });
      host.addEventListener('pointercancel', end, { passive: true });
      host.addEventListener('pointerleave', function () { tx = 0; ty = 0; }, { passive: true });
    }

    /* hotspots: real links to the live bots (desktop layout only, keyboard-focusable) */
    if (hero) {
      var layer = doc.createElement('div'); layer.className = 'imm-hots';
      CHANNELS.forEach(function (c, k) {
        var a = doc.createElement('a');
        a.className = 'imm-hot' + (k % 2 === 0 ? ' imm-hot-left' : ''); a.href = c.href; a.target = '_blank'; a.rel = 'noopener';
        a.setAttribute('aria-label', c.label); a.style.setProperty('--imm-c', c.color);
        a.innerHTML = '<span class="imm-hot-dot"></span><span class="imm-hot-label"></span>';
        a.lastChild.textContent = c.name;
        var on = function () { glowT[k] = 1; burst = Math.max(burst, 0.4); }, off = function () { glowT[k] = 0; };
        a.addEventListener('pointerenter', on); a.addEventListener('pointerleave', off); a.addEventListener('focus', on); a.addEventListener('blur', off);
        layer.appendChild(a); hots.push(a);
      });
      host.appendChild(layer);
    }

    /* pause control (WCAG 2.2.2) */
    var btn = doc.createElement('button');
    btn.type = 'button'; btn.className = 'imm-pause';
    var setBtn = function () { btn.textContent = paused ? '▶ অ্যানিমেশন চালু' : '⏸ অ্যানিমেশন থামান'; btn.setAttribute('aria-pressed', paused ? 'true' : 'false'); };
    btn.addEventListener('click', function () { paused = !paused; setBtn(); if (paused) { stop(); draw(simT); } else start(); });
    if (!REDUCE) { setBtn(); host.appendChild(btn); }

    /* lifecycle */
    var io = 'IntersectionObserver' in win ? new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) start(); else stop(); }, { threshold: 0 }) : null;
    if (io) io.observe(host);
    var ro = 'ResizeObserver' in win ? new ResizeObserver(function () { layout(); }) : null;
    if (ro) ro.observe(host); else win.addEventListener('resize', layout);
    var onScroll = function () {
      var r = host.getBoundingClientRect();
      scrollP = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      canvas.style.opacity = String(1 - scrollP * 0.85);
    };
    if (hero && !REDUCE) { win.addEventListener('scroll', onScroll, { passive: true }); onScroll(); }
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); else start(); });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); paused = true; canvas.remove(); if (btn.parentNode) btn.remove(); hots.forEach(function (h) { h.remove(); }); host.classList.remove('imm-host'); });

    layout();
    if (REDUCE) draw(simT); else start();
    host.classList.add('imm-ready');
    var api = { mode: mode, tier: TIER, get particles() { return n; }, get quality() { return quality; }, get running() { return running; }, burst: function () { burst = 1.2; } };
    return api;
  }

  function boot() {
    initTilt();
    var hero = doc.getElementById('hero');
    /* the hero is above the fold: never let its headline/CTA wait for the page's scroll observer */
    if (hero) Array.prototype.forEach.call(hero.querySelectorAll('.reveal'), function (el) { el.classList.add('is-visible'); });
    var host = hero || doc.querySelector('body > section.relative.overflow-hidden, main section.relative.overflow-hidden, .en-hero, body > section');
    if (!host) return;
    var api = mountScene(host, hero ? 'hero' : 'ambient');
    win.__imm = api || { mode: 'fallback', reason: SAVE ? 'save-data' : 'webgl-unavailable' };
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
