import * as THREE from 'three';
import type { StoreData, Wall } from '../types';
import { buildRoom } from './room';
import { buildSections, type ProductNode } from './sections';
import { CameraRig } from './camera';

export interface Store3DOptions {
  canvas: HTMLCanvasElement;
  data: StoreData;
  reducedMotion: boolean;
  onProgress: (fraction: number) => void;
  onProductTap: (sku: string) => void;
  onEmptyTap: () => void;
}

export interface Store3D {
  /** cinematic glide from the entry preset to the hero wall */
  enter(): Promise<void>;
  goToSection(sectionId: string | 'store'): Promise<void>;
  focusProduct(sku: string): Promise<void>;
  unfocus(): Promise<void>;
  setActive(active: boolean): void;
  dispose(): void;
}

const TAP_MAX_PX = 7;
const TAP_MAX_MS = 600;

export async function createStore3D(opts: Store3DOptions): Promise<Store3D> {
  const { canvas, data, reducedMotion } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const rig = new CameraRig(1);
  const sizeToWindow = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    rig.setAspect(w / h);
    needsRender = true;
  };

  buildRoom(scene, data);
  opts.onProgress(0.55);

  const total = data.products.length;
  let loaded = 0;
  const loader = new THREE.TextureLoader();
  const nodes = buildSections(scene, data, loader, () => {
    loaded++;
    opts.onProgress(0.55 + 0.4 * (loaded / total));
    needsRender = true;
  });
  const bySku = new Map(nodes.map((n) => [n.sku, n]));
  const sectionWall = new Map<string, Wall>(data.sections.map((s) => [s.id, s.wall]));

  // ---- render loop (on demand) -------------------------------------------------------
  let needsRender = true;
  let active = true;
  let raf = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!active) return;
    const camChanged = rig.update(now);
    if (camChanged || needsRender) {
      renderer.render(scene, rig.camera);
      needsRender = false;
    }
  };
  sizeToWindow();
  window.addEventListener('resize', sizeToWindow);
  raf = requestAnimationFrame(loop);

  // first paint so the glide starts from a drawn frame
  renderer.render(scene, rig.camera);
  opts.onProgress(0.6);

  // wait for textures, but never longer than 1.4 s (slow data: planes fill in during the glide)
  await new Promise<void>((res) => {
    const t = setTimeout(res, 1400);
    const check = () => {
      if (loaded >= total) {
        clearTimeout(t);
        res();
      } else setTimeout(check, 60);
    };
    check();
  });
  opts.onProgress(0.97);

  // ---- input: drag to look, pinch/wheel to zoom, tap to pick ---------------------------
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt = 0;
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;
  let moved = false;
  let pinchDist = 0;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const meshes = nodes.map((n) => n.mesh);
  let hovered: ProductNode | null = null;

  const pick = (x: number, y: number): ProductNode | null => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, rig.camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? (bySku.get(hit.object.userData.sku as string) ?? null) : null;
  };

  const setHover = (n: ProductNode | null) => {
    if (hovered === n) return;
    if (hovered) hovered.mesh.scale.setScalar(1);
    hovered = n;
    if (hovered) hovered.mesh.scale.setScalar(1.06);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
    needsRender = true;
  };

  const onDown = (e: PointerEvent) => {
    if (!active) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      downAt = performance.now();
      downX = lastX = e.clientX;
      downY = lastY = e.clientY;
      moved = false;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
    canvas.classList.add('dragging');
  };
  const onMove = (e: PointerEvent) => {
    if (!active) return;
    if (!pointers.has(e.pointerId)) {
      // hover (mouse only)
      if (e.pointerType === 'mouse') setHover(pick(e.clientX, e.clientY));
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) rig.applyZoom(d / pinchDist);
      pinchDist = d;
      moved = true;
      return;
    }
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (!moved && Math.hypot(e.clientX - downX, e.clientY - downY) > TAP_MAX_PX) moved = true;
    if (moved) rig.applyDrag(dx, dy);
  };
  const onUp = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) canvas.classList.remove('dragging');
    if (!active) return;
    const quick = performance.now() - downAt < TAP_MAX_MS;
    if (!moved && quick && pointers.size === 0) {
      const n = pick(e.clientX, e.clientY);
      if (n) opts.onProductTap(n.sku);
      else opts.onEmptyTap();
    }
  };
  const onWheel = (e: WheelEvent) => {
    if (!active) return;
    e.preventDefault();
    rig.applyZoom(e.deltaY < 0 ? 1.08 : 0.93);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!active) return;
    const step = 18;
    if (e.key === 'ArrowLeft') rig.applyDrag(-step, 0);
    else if (e.key === 'ArrowRight') rig.applyDrag(step, 0);
    else if (e.key === 'ArrowUp') rig.applyDrag(0, -step);
    else if (e.key === 'ArrowDown') rig.applyDrag(0, step);
    else return;
    e.preventDefault();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);
  canvas.style.cursor = 'grab';

  const dur = (ms: number) => (reducedMotion ? 0 : ms);
  const portrait = () => window.innerHeight > window.innerWidth;

  return {
    enter: () => rig.goTo(rig.preset('north'), dur(2000)),
    goToSection: (id) => {
      const wall = id === 'store' ? null : sectionWall.get(id);
      return rig.goTo(wall ? rig.preset(wall) : rig.preset('store'), dur(900));
    },
    focusProduct: (sku) => {
      const n = bySku.get(sku);
      if (!n) return Promise.resolve();
      setHover(null);
      return rig.goTo(rig.focusPreset(n.position, n.normal, portrait()), dur(700));
    },
    unfocus: () => Promise.resolve(),
    setActive: (a) => {
      active = a;
      needsRender = a;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', sizeToWindow);
      renderer.dispose();
    },
  };
}
