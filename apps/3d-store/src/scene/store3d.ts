import * as THREE from 'three';
import type { StoreData, Wall } from '../types';
import { buildRoom } from './room';
import { buildSections, type ProductNode } from './sections';
import { CameraRig } from './camera';
import { refreshTextTextures } from './textures';

export interface Store3DOptions {
  canvas: HTMLCanvasElement;
  data: StoreData;
  reducedMotion: boolean;
  /** keep the 3D view even on a CPU-rendered (SwiftShader) WebGL — used by ?view=3d and the tests */
  allowSoftwareGL: boolean;
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
  /** redraw sign/poster/label textures (called when the Bangla web font finishes loading) */
  refreshText(): void;
  setActive(active: boolean): void;
  dispose(): void;
}

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

const TAP_MAX_PX = 7;
const TAP_MAX_MS = 600;

export async function createStore3D(opts: Store3DOptions): Promise<Store3D> {
  const { canvas, data, reducedMotion } = opts;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  } catch (e) {
    throw Object.assign(new Error('WebGL unavailable'), { code: 'no_webgl', cause: e });
  }
  if (!opts.allowSoftwareGL) {
    // WebGL rendered on the CPU (SwiftShader / llvmpipe) is far too slow for a room → 2D view
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software/i.test(name)) {
      renderer.dispose();
      renderer.forceContextLoss();
      throw Object.assign(new Error('software WebGL'), { code: 'software_gl' });
    }
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  // getProgramInfoLog/LINK_STATUS on first use stalls the main thread until the driver has linked every program
  // (hundreds of ms on mobile GPUs); keep the check in dev only
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  performance.mark('gtm:renderer');

  const scene = new THREE.Scene();
  const rig = new CameraRig(1);
  let needsRender = true;
  let active = true;
  /** GPU work (texture swaps, text redraws) is drained a few items per frame so no frame becomes a long task */
  const gpuQueue: Array<() => void> = [];
  const sizeToWindow = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    rig.setAspect(w / h);
    needsRender = true;
  };

  await buildRoom(scene, data, (job) => gpuQueue.push(job));
  performance.mark('gtm:room');
  opts.onProgress(0.55);
  await yieldToMain();

  const total = data.products.length;
  let loaded = 0;
  const loader = new THREE.TextureLoader();
  const nodes = await buildSections(scene, data, loader, (apply) => {
    gpuQueue.push(() => {
      apply();
      loaded++;
      opts.onProgress(0.55 + 0.4 * (loaded / total));
      needsRender = true;
    });
  });
  const bySku = new Map(nodes.map((n) => [n.sku, n]));
  const sectionWall = new Map<string, Wall>(data.sections.map((s) => [s.id, s.wall]));
  performance.mark('gtm:sections');

  // ---- render loop (on demand) -------------------------------------------------------
  let raf = 0;
  // adaptive: when a frame costs more than ~14 ms of main-thread time (slow phone / CPU throttling) the
  // scene is rendered every other frame, so animations stay smooth-ish and no frame becomes a long task
  let lastCost = 0;
  let skip = false;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!active) return;
    if (lastCost > 14 && !skip) {
      skip = true;
      return;
    }
    skip = false;
    const t0 = performance.now();
    // drain queued GPU work within a small time budget (more per frame when frames are rare, e.g. a throttled tab)
    while (gpuQueue.length && performance.now() - t0 < 6) gpuQueue.shift()?.();
    const camChanged = rig.update(now);
    if (camChanged || needsRender) {
      renderer.render(scene, rig.camera);
      needsRender = false;
    }
    lastCost = performance.now() - t0;
  };
  sizeToWindow();
  window.addEventListener('resize', sizeToWindow);
  raf = requestAnimationFrame(loop);

  // Shaders. Assembling + compiling one MeshStandardMaterial program costs ~100 ms on a slow phone, so each
  // distinct program is compiled in its own task (only one representative mesh visible at a time) and the
  // driver links in the background (KHR_parallel_shader_compile) while the main thread stays free.
  await yieldToMain();
  try {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    const sig = (m: THREE.Mesh) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      return `${mat.type}|${mat.map ? 'map' : ''}|${mat.alphaTest > 0 ? 'cut' : ''}|${mat.transparent ? 't' : ''}`;
    };
    const reps = new Map<string, THREE.Mesh>();
    for (const m of meshes) if (!reps.has(sig(m))) reps.set(sig(m), m);
    // the first compile also pays three.js' one-time shader setup: start with the smallest program (MeshBasicMaterial)
    const ordered = [...reps.values()].sort((x, y) => Number((y.material as THREE.Material).type === 'MeshBasicMaterial') - Number((x.material as THREE.Material).type === 'MeshBasicMaterial'));
    for (const rep of ordered) {
      for (const m of meshes) m.visible = m === rep;
      await renderer.compileAsync(scene, rig.camera);
      await yieldToMain();
    }
    for (const m of meshes) m.visible = true;
    performance.mark('gtm:compiled');
    // fetching a program's uniform locations is ~100 sync GPU calls; one program per task
    for (const p of renderer.info.programs ?? []) {
      p.getUniforms();
      await yieldToMain();
    }
  } catch {
    /* older browsers: the first render compiles synchronously */
  }
  await yieldToMain();
  // first paint so the glide starts from a drawn frame
  renderer.render(scene, rig.camera);
  performance.mark('gtm:first-render');
  opts.onProgress(0.6);


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

  // test hook (read-only): screen position of a product + camera position
  (window as unknown as { __gtm3d?: unknown }).__gtm3d = {
    screenPos: (sku: string) => {
      const n = bySku.get(sku);
      if (!n) return null;
      const v = n.position.clone().project(rig.camera);
      return { x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight, visible: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 };
    },
    camPos: () => rig.camera.position.toArray(),
    camDir: () => rig.camera.getWorldDirection(new THREE.Vector3()).toArray(),
  };

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
    refreshText: () => {
      for (const job of refreshTextTextures()) gpuQueue.push(job);
      needsRender = true;
    },
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
