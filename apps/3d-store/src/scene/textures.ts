import * as THREE from 'three';

const FONT = '"Noto Sans Bengali", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Light oak floor with faint planks and a soft vignette (fakes baked lighting). */
export function floorTexture(base = '#D9C4A3'): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(90,60,30,0.14)';
  ctx.lineWidth = 2;
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
    // plank end joints, staggered
    const off = (y / 64) % 2 ? 160 : 340;
    ctx.beginPath();
    ctx.moveTo(off, y);
    ctx.lineTo(off, y + 64);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,85,45,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const y = (i * 37) % 512;
    const x = (i * 131) % 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 60 + (i % 5) * 20, y);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(256, 256, 120, 256, 256, 360);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  return toTexture(c);
}

/** Radial alpha blob used as a contact shadow under fixtures. */
export function shadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.38)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.14)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return toTexture(c, false);
}

/** Brand sign above the hero wall. */
export function signTexture(name: string, tagline: string, accent: string): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(1024, 320);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(0, 0, 1024, 320, 36);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.roundRect(18, 18, 988, 284, 28);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 118px ${FONT}`;
  ctx.fillText(name, 512, 130);
  ctx.font = `500 46px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(tagline, 512, 240);
  return toTexture(c);
}

/** Wall poster: big Bangla line + sub line in the brand palette. */
export function posterTexture(text: string, sub: string | undefined, accent: string): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 683);
  ctx.fillStyle = '#FFFDF8';
  ctx.fillRect(0, 0, 512, 683);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 498, 669);
  ctx.fillStyle = accent;
  ctx.fillRect(40, 60, 90, 10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `700 60px ${FONT}`;
  const lines = wrapLines(ctx, text, 430);
  let y = 110;
  for (const l of lines) {
    ctx.fillText(l, 40, y);
    y += 86;
  }
  if (sub) {
    ctx.fillStyle = '#4A4540';
    ctx.font = `400 34px ${FONT}`;
    for (const l of wrapLines(ctx, sub, 430)) {
      ctx.fillText(l, 40, y + 20);
      y += 50;
    }
  }
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(452, 620, 22, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c);
}

/** Pegboard with a dot grid. */
export function pegboardTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#E9E0D2';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#C9BBA8';
  for (let y = 16; y < 256; y += 32)
    for (let x = 16; x < 256; x += 32) {
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2.6);
  return t;
}

/** Section name label placed above each fixture. */
export function labelTexture(text: string, accent: string): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 128);
  ctx.fillStyle = '#FFFDF8';
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 128, 64);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(4, 4, 504, 120, 60);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 60px ${FONT}`;
  ctx.fillText(text, 256, 66);
  return toTexture(c);
}
