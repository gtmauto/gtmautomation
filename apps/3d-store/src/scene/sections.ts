import * as THREE from 'three';
import type { Product, Section, StoreData } from '../types';
import { MATERIALS, faceRoom, wallFrame, wallPoint, type WallFrame } from './room';
import { labelTexture, pegboardTexture, shadowTexture, stdMat, textMaterial } from './textures';

export interface ProductNode {
  sku: string;
  section: string;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  /** world position of the product centre */
  position: THREE.Vector3;
  /** direction the product faces (into the room) */
  normal: THREE.Vector3;
}

interface Slot {
  along: number;
  y: number;
  out: number;
  w: number;
  h: number;
}

const PLACEHOLDER = new THREE.Color('#EDE6DB');
const blankTexture = (() => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace; // same shader program as the real (sRGB) product textures
  t.needsUpdate = true;
  return t;
})();

function productPlane(
  p: Product,
  f: WallFrame,
  slot: Slot,
  loader: THREE.TextureLoader,
  onTexture: (apply: () => void) => void,
): ProductNode {
  const mat = stdMat({ color: PLACEHOLDER, map: blankTexture, roughness: 0.9, metalness: 0, opacity: 0, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(slot.w, slot.h), mat);
  mesh.position.copy(wallPoint(f, slot.along, slot.y, slot.out));
  faceRoom(mesh, f);
  mesh.userData.sku = p.sku;
  loader.load(p.image, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 2;
    tex.generateMipmaps = true;
    onTexture(() => {
      mat.map = tex;
      mat.opacity = 1;
      mat.color.set('#FFFFFF');
      mat.needsUpdate = true;
    });
  });
  return { sku: p.sku, section: p.section, mesh, position: mesh.position.clone(), normal: f.normal.clone() };
}

function addShadow(scene: THREE.Scene, f: WallFrame, along: number, out: number, w: number, d: number, tex: THREE.Texture) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    stdMat({ map: tex, depthWrite: false, opacity: 0.9, alphaTest: 0.02 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.copy(wallPoint(f, along, 0.006, out));
  scene.add(m);
}

function addLabel(scene: THREE.Scene, f: WallFrame, text: string, accent: string, y: number) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.4),
    textMaterial(() => labelTexture(text, accent), { roughness: 0.7 }),
  );
  m.position.copy(wallPoint(f, 0, y, 0.03));
  faceRoom(m, f);
  scene.add(m);
}

/** Hanging garments on a metal bar between two wooden posts. */
function buildRack(scene: THREE.Scene, f: WallFrame, products: Product[], loader: THREE.TextureLoader, shadow: THREE.Texture, accent: string, label: string, onTexture: (apply: () => void) => void): ProductNode[] {
  const out = 0.55;
  const barY = 2.35;
  const span = 5.2;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, span, 10), MATERIALS.metal);
  bar.position.copy(wallPoint(f, 0, barY, out));
  bar.lookAt(bar.position.clone().add(f.right));
  bar.rotateX(Math.PI / 2);
  scene.add(bar);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, barY + 0.05, 0.08), MATERIALS.wood);
    post.position.copy(wallPoint(f, (s * span) / 2, (barY + 0.05) / 2, out));
    faceRoom(post, f);
    scene.add(post);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), MATERIALS.wood);
    foot.position.copy(wallPoint(f, (s * span) / 2, 0.025, out));
    faceRoom(foot, f);
    scene.add(foot);
  }
  addShadow(scene, f, 0, out, span + 0.8, 1.2, shadow);
  addLabel(scene, f, label, accent, 2.8);
  const n = products.length;
  const step = (span - 0.8) / Math.max(1, n - 1);
  return products.map((p, i) =>
    productPlane(p, f, { along: -(span - 0.8) / 2 + i * step, y: barY - 0.6, out: out + 0.02 + (i % 2) * 0.01, w: 0.78, h: 1.08 }, loader, onTexture),
  );
}

/** Two wooden shelves, items standing on them. */
function buildShelf(scene: THREE.Scene, f: WallFrame, products: Product[], loader: THREE.TextureLoader, shadow: THREE.Texture, accent: string, label: string, onTexture: (apply: () => void) => void): ProductNode[] {
  const width = 4.0;
  const depth = 0.42;
  const rows = [2.0, 1.15];
  for (const y of rows) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, depth), MATERIALS.wood);
    shelf.position.copy(wallPoint(f, 0, y, depth / 2));
    faceRoom(shelf, f);
    scene.add(shelf);
    for (const s of [-1, 1]) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, depth - 0.06), MATERIALS.woodDark);
      br.position.copy(wallPoint(f, (s * (width - 0.4)) / 2, y - 0.18, (depth - 0.06) / 2));
      faceRoom(br, f);
      scene.add(br);
    }
  }
  // side panels
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, depth), MATERIALS.woodDark);
    side.position.copy(wallPoint(f, (s * width) / 2, 1.2, depth / 2));
    faceRoom(side, f);
    scene.add(side);
  }
  addShadow(scene, f, 0, depth / 2 + 0.1, width + 0.8, 1.0, shadow);
  addLabel(scene, f, label, accent, 2.75);
  const perRow = Math.ceil(products.length / rows.length);
  return products.map((p, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const step = (width - 0.9) / Math.max(1, perRow - 1);
    const along = -(width - 0.9) / 2 + col * step;
    return productPlane(p, f, { along, y: rows[row] + 0.03 + 0.36, out: depth / 2 + 0.02, w: 0.86, h: 0.72 }, loader, onTexture);
  });
}

/** Items pinned on a pegboard in a grid. */
function buildPegboard(scene: THREE.Scene, f: WallFrame, products: Product[], loader: THREE.TextureLoader, shadow: THREE.Texture, accent: string, label: string, onTexture: (apply: () => void) => void): ProductNode[] {
  const bw = 4.2;
  const bh = 2.5;
  const cy = 1.7;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(bw, bh, 0.05),
    stdMat({ map: pegboardTexture(), roughness: 0.9 }),
  );
  board.position.copy(wallPoint(f, 0, cy, 0.025));
  faceRoom(board, f);
  scene.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.12, bh + 0.12, 0.03), MATERIALS.wood);
  frame.position.copy(wallPoint(f, 0, cy, 0.01));
  faceRoom(frame, f);
  scene.add(frame);
  addShadow(scene, f, 0, 0.25, bw + 0.6, 0.7, shadow);
  addLabel(scene, f, label, accent, cy + bh / 2 + 0.3);
  const cols = 3;
  const rowsY = [cy + 0.62, cy - 0.62];
  return products.map((p, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const along = (col - 1) * 1.3;
    return productPlane(p, f, { along, y: rowsY[Math.min(row, rowsY.length - 1)], out: 0.08, w: 0.95, h: 0.68 }, loader, onTexture);
  });
}

export async function buildSections(scene: THREE.Scene, data: StoreData, loader: THREE.TextureLoader, onTexture: (apply: () => void) => void): Promise<ProductNode[]> {
  const shadow = shadowTexture();
  const accent = data.store.primaryColor;
  const nodes: ProductNode[] = [];
  for (const sec of data.sections) {
    const f = wallFrame(sec.wall);
    const products = data.products.filter((p) => p.section === sec.id);
    const built = buildByType(sec, scene, f, products, loader, shadow, accent, onTexture);
    for (const n of built) {
      scene.add(n.mesh);
      nodes.push(n);
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  return nodes;
}

function buildByType(sec: Section, scene: THREE.Scene, f: WallFrame, products: Product[], loader: THREE.TextureLoader, shadow: THREE.Texture, accent: string, onTexture: (apply: () => void) => void): ProductNode[] {
  switch (sec.display) {
    case 'rack':
      return buildRack(scene, f, products, loader, shadow, accent, sec.label, onTexture);
    case 'shelf':
      return buildShelf(scene, f, products, loader, shadow, accent, sec.label, onTexture);
    case 'pegboard':
      return buildPegboard(scene, f, products, loader, shadow, accent, sec.label, onTexture);
  }
}
