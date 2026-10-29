import * as THREE from 'three';
import type { StoreData, Wall } from '../types';
import { floorTexture, posterTexture, signTexture, stdMat, textMaterial } from './textures';

export const ROOM = { w: 12, d: 12, h: 4 } as const;

export interface WallFrame {
  center: THREE.Vector3;
  /** points into the room */
  normal: THREE.Vector3;
  /** "right" as seen by someone standing in the room looking at the wall */
  right: THREE.Vector3;
  length: number;
}

const UP = new THREE.Vector3(0, 1, 0);

export function wallFrame(wall: Wall): WallFrame {
  const hw = ROOM.w / 2;
  const hd = ROOM.d / 2;
  switch (wall) {
    case 'north':
      return { center: new THREE.Vector3(0, 0, -hd), normal: new THREE.Vector3(0, 0, 1), right: new THREE.Vector3(1, 0, 0), length: ROOM.w };
    case 'south':
      return { center: new THREE.Vector3(0, 0, hd), normal: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(-1, 0, 0), length: ROOM.w };
    case 'east':
      return { center: new THREE.Vector3(hw, 0, 0), normal: new THREE.Vector3(-1, 0, 0), right: new THREE.Vector3(0, 0, 1), length: ROOM.d };
    case 'west':
      return { center: new THREE.Vector3(-hw, 0, 0), normal: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(0, 0, -1), length: ROOM.d };
  }
}

/** Point on/near a wall: `along` metres to the right, `y` up, `out` metres into the room. */
export function wallPoint(f: WallFrame, along: number, y: number, out: number): THREE.Vector3 {
  return f.center.clone().addScaledVector(f.right, along).addScaledVector(UP, y).addScaledVector(f.normal, out);
}

/** Orient an object so its +Z faces the room (away from the wall). */
export function faceRoom(obj: THREE.Object3D, f: WallFrame): void {
  obj.lookAt(obj.position.clone().add(f.normal));
}

export const MATERIALS = {
  wood: stdMat({ color: '#C9A776', roughness: 0.78, metalness: 0 }),
  woodDark: stdMat({ color: '#A8865B', roughness: 0.8, metalness: 0 }),
  metal: stdMat({ color: '#9AA0A6', roughness: 0.35, metalness: 0.7 }),
};

/** `later` receives work that may run a frame or two after the first paint (poster textures). */
export async function buildRoom(scene: THREE.Scene, data: StoreData, later: (job: () => void) => void): Promise<void> {
  const yieldToMain = () => new Promise<void>((res) => setTimeout(res, 0));
  const accent = data.store.primaryColor;
  const { w, d, h } = ROOM;

  scene.background = new THREE.Color('#F4EFE8');

  // Lights: hemisphere + 1 directional + ambient fill (no shadow maps; floor vignette fakes it)
  scene.add(new THREE.HemisphereLight('#FFF6EA', '#CDB996', 0.95));
  const key = new THREE.DirectionalLight('#FFFFFF', 1.35);
  key.position.set(3, 6.5, 3.5);
  scene.add(key);
  scene.add(new THREE.AmbientLight('#FFFFFF', 0.35));

  // Floor
  const floorMat = stdMat({ map: floorTexture(), roughness: 0.85, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Rug under the centre
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 40),
    stdMat({ color: new THREE.Color('#D9C4A3').lerp(new THREE.Color(accent), 0.18), roughness: 1 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.004;
  scene.add(rug);

  // Ceiling + two light strips
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), stdMat({ color: '#FAF7F2', roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = h;
  scene.add(ceil);
  const stripMat = stdMat({ color: '#FFFFFF', emissive: '#FFF4E0', emissiveIntensity: 0.9 });
  for (const z of [-2.5, 2.5]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 0.3), stripMat);
    strip.position.set(0, h - 0.03, z);
    scene.add(strip);
  }

  // Walls
  const wallMat = stdMat({ color: '#F4EFE8', roughness: 0.95 });
  const wallMatSide = stdMat({ color: '#EFE8DE', roughness: 0.95 });
  const mkWall = (wall: Wall, mat: THREE.Material) => {
    const f = wallFrame(wall);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(f.length, h), mat);
    m.position.copy(wallPoint(f, 0, h / 2, 0));
    faceRoom(m, f);
    scene.add(m);
    // baseboard
    const bb = new THREE.Mesh(new THREE.BoxGeometry(f.length, 0.12, 0.04), MATERIALS.woodDark);
    bb.position.copy(wallPoint(f, 0, 0.06, 0.02));
    faceRoom(bb, f);
    scene.add(bb);
  };
  mkWall('north', wallMat);
  mkWall('south', wallMat);
  mkWall('east', wallMatSide);
  mkWall('west', wallMatSide);

  await yieldToMain();

  // Brand sign on the hero (north) wall
  const north = wallFrame('north');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 1.125),
    textMaterial(() => signTexture(data.store.name, data.store.tagline, accent), { roughness: 0.6 }),
  );
  sign.position.copy(wallPoint(north, 0, 3.4, 0.03));
  faceRoom(sign, north);
  scene.add(sign);

  await yieldToMain();

  // Posters: the text is drawn one poster per frame after the first paint (Bangla shaping is the costly part)
  for (const p of data.posters) {
    const f = wallFrame(p.wall);
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), stdMat({ color: '#FFFDF8', roughness: 0.8 }));
    poster.position.copy(wallPoint(f, p.offset * (f.length / 2 - 1.0), 2.05, 0.02));
    faceRoom(poster, f);
    scene.add(poster);
    later(() => {
      poster.material.dispose();
      poster.material = textMaterial(() => posterTexture(p.text, p.sub, accent), { roughness: 0.8 });
    });
  }

  // A plant-like accent in the two far corners (cheap, adds life)
  const potMat = stdMat({ color: '#B5633C', roughness: 0.9 });
  const leafMat = stdMat({ color: '#3F7A4A', roughness: 0.9 });
  for (const x of [-w / 2 + 0.6, w / 2 - 0.6]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 14), potMat);
    pot.position.set(x, 0.2, -d / 2 + 0.6);
    scene.add(pot);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 8), leafMat);
    leaf.position.set(x, 1.0, -d / 2 + 0.6);
    scene.add(leaf);
  }
}
