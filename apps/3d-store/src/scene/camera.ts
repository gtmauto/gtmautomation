import * as THREE from 'three';
import type { Wall } from '../types';
import { ROOM, wallFrame, wallPoint } from './room';

export interface CamPreset {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

const DEG = Math.PI / 180;
const YAW_LIMIT = 28 * DEG;
const PITCH_LIMIT = 13 * DEG;
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.45;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Camera presets per wall + overview, smooth tweens, limited look-around and zoom. No free fly. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private pos = new THREE.Vector3();
  private target = new THREE.Vector3();
  private fov = 55;
  private from: CamPreset | null = null;
  private to: CamPreset | null = null;
  private t0 = 0;
  private dur = 0;
  private resolve: (() => void) | null = null;

  private yaw = 0;
  private pitch = 0;
  private zoom = 1;
  private yawFrom = 0;
  private pitchFrom = 0;

  private dirty = true;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.08, 40);
    const entry = this.preset('entry');
    this.pos.copy(entry.pos);
    this.target.copy(entry.target);
    this.fov = entry.fov;
    this.apply();
  }

  preset(name: 'entry' | 'store' | Wall): CamPreset {
    const hd = ROOM.d / 2;
    switch (name) {
      case 'entry':
        return { pos: new THREE.Vector3(0, 2.1, hd - 0.4), target: new THREE.Vector3(0, 1.7, -hd), fov: 50 };
      case 'store':
        return { pos: new THREE.Vector3(0, 1.75, 3.6), target: new THREE.Vector3(0, 1.55, -hd), fov: 64 };
      default: {
        const f = wallFrame(name);
        return { pos: wallPoint(f, 0, 1.65, 4.6), target: wallPoint(f, 0, 1.8, 0), fov: 52 };
      }
    }
  }

  /** Camera position for a product focus (close-up, slightly above, product in the upper half on portrait). */
  focusPreset(position: THREE.Vector3, normal: THREE.Vector3, portrait: boolean): CamPreset {
    const dist = portrait ? 1.75 : 1.55;
    const drop = portrait ? 0.42 : 0.05;
    const pos = position.clone().addScaledVector(normal, dist).add(new THREE.Vector3(0, 0.08 - drop, 0));
    const target = position.clone().add(new THREE.Vector3(0, -drop, 0));
    return { pos, target, fov: portrait ? 42 : 36 };
  }

  goTo(p: CamPreset, durationMs: number): Promise<void> {
    this.finishTween();
    this.from = { pos: this.pos.clone(), target: this.target.clone(), fov: this.fov };
    this.to = { pos: p.pos.clone(), target: p.target.clone(), fov: p.fov };
    this.yawFrom = this.yaw;
    this.pitchFrom = this.pitch;
    this.t0 = performance.now();
    this.dur = Math.max(0, durationMs);
    this.dirty = true;
    if (this.dur === 0) {
      this.pos.copy(p.pos);
      this.target.copy(p.target);
      this.fov = p.fov;
      this.yaw = this.pitch = 0;
      this.zoom = 1;
      this.from = this.to = null;
      this.apply();
      return Promise.resolve();
    }
    return new Promise((res) => (this.resolve = res));
  }

  private finishTween() {
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r();
    }
    this.from = this.to = null;
  }

  get isMoving(): boolean {
    return this.to !== null;
  }

  applyDrag(dx: number, dy: number): void {
    this.yaw = THREE.MathUtils.clamp(this.yaw - dx * 0.22 * DEG, -YAW_LIMIT, YAW_LIMIT);
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.18 * DEG, -PITCH_LIMIT, PITCH_LIMIT);
    this.dirty = true;
  }

  applyZoom(factor: number): void {
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, ZOOM_MIN, ZOOM_MAX);
    this.dirty = true;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.dirty = true;
  }

  /** Advance tweens; returns true when the camera changed and a render is needed. */
  update(now: number): boolean {
    if (this.to && this.from) {
      const k = this.dur === 0 ? 1 : Math.min(1, (now - this.t0) / this.dur);
      const e = easeInOutCubic(k);
      this.pos.lerpVectors(this.from.pos, this.to.pos, e);
      this.target.lerpVectors(this.from.target, this.to.target, e);
      this.fov = this.from.fov + (this.to.fov - this.from.fov) * e;
      this.yaw = this.yawFrom * (1 - e);
      this.pitch = this.pitchFrom * (1 - e);
      this.zoom = 1 + (this.zoom - 1) * (1 - e);
      this.dirty = true;
      if (k >= 1) this.finishTween();
    }
    if (!this.dirty) return false;
    this.apply();
    this.dirty = false;
    return true;
  }

  private apply(): void {
    const cam = this.camera;
    cam.position.copy(this.pos);
    const dir = this.target.clone().sub(this.pos).normalize();
    // yaw around world up, pitch around the camera's right axis
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    dir.applyAxisAngle(right, this.pitch);
    cam.lookAt(this.pos.clone().add(dir));
    cam.fov = this.fov / this.zoom;
    cam.updateProjectionMatrix();
  }
}
