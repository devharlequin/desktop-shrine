import * as THREE from 'three';
import { loadTex } from './scene';
import type { Activity } from '../core/clauding';

const FRAMES = { idle: 0, step: 1, bow: 2, sleep: 3 } as const;
export type Frame = keyof typeof FRAMES;

/** Named spots in scene coords. Tuned against the sliced layout (source/S mapping). */
export const SPOTS = {
  stepsBase: new THREE.Vector3(-30, -100, 26),
  plate: new THREE.Vector3(0, -92, 27),
  sanctum: new THREE.Vector3(0, -18, 9),
  candleL: new THREE.Vector3(-62, -55, 24),
  candleR: new THREE.Vector3(60, -55, 24),
  sweepA: new THREE.Vector3(-80, -95, 26),
  sweepB: new THREE.Vector3(55, -95, 26),
  sandEdge: new THREE.Vector3(-55, -105, 28),
};

export class ClaudingView {
  mesh: THREE.Mesh;
  private tex: THREE.Texture;
  private target: THREE.Vector3 | null = null;
  private queue: THREE.Vector3[] = [];
  onArrive: (() => void) | null = null;

  constructor() {
    this.tex = loadTex('clauding');
    this.tex.repeat.set(0.25, 1);
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshLambertMaterial({ map: this.tex, transparent: true, alphaTest: 0.01 }),
    );
    this.mesh.position.copy(SPOTS.stepsBase);
  }

  setFrame(f: Frame) { this.tex.offset.x = FRAMES[f] * 0.25; }

  walkTo(...pts: THREE.Vector3[]) {
    this.queue = [...pts];
    this.target = this.queue.shift() ?? null;
  }

  get busy() { return this.target !== null; }

  update(dt: number, t: number) {
    if (!this.target) return;
    const p = this.mesh.position;
    const d = this.target.clone().sub(p);
    const step = 22 * dt; // px/sec — unhurried
    if (d.length() <= step) {
      p.copy(this.target);
      this.target = this.queue.shift() ?? null;
      if (!this.target) {
        this.setFrame('idle');
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      }
    } else {
      p.add(d.setLength(step));
      this.setFrame(Math.floor(t * 5) % 2 ? 'step' : 'idle'); // walk cycle
    }
  }

  /** Ambient behavior per activity when not walking; call each frame. */
  ambient(activity: Activity, t: number) {
    if (this.busy || activity === 'ceremony') return;
    if (activity === 'sleeping') {
      this.setFrame('sleep');
      this.mesh.position.copy(SPOTS.sanctum);
      return;
    }
    // wander cadence: act once when the second-counter crosses a slot boundary
    const slot = Math.floor(t);
    if (slot === this.lastSlot) return;
    this.lastSlot = slot;
    if (activity === 'sweeping' && slot % 9 === 0) {
      this.walkTo(Math.random() < 0.5 ? SPOTS.sweepA : SPOTS.sweepB);
    } else if (activity === 'lighting-candles' && slot % 12 === 0) {
      this.walkTo(Math.random() < 0.5 ? SPOTS.candleL : SPOTS.candleR);
    } else if (activity === 'tending' && slot % 15 === 0) {
      this.walkTo(Math.random() < 0.5 ? SPOTS.sandEdge : SPOTS.stepsBase);
    } else if (activity === 'idle') {
      this.setFrame('idle');
    }
  }
  private lastSlot = -1;
}
