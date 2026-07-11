import * as THREE from 'three';
import { loadTex, S } from './scene';
import type { Activity } from '../core/clauding';

export type Frame = 'idle' | 'step' | 'bow' | 'sleep';

/** Named spots in scene coords. Tuned against the sliced layout. */
export const SPOTS = {
  stepsBase: new THREE.Vector3(-30, -100, 26),
  plate: new THREE.Vector3(0, -92, 27),
  doorway: new THREE.Vector3(-30, -38, 13),       // the little door left of the altar
  sanctum: new THREE.Vector3(-30, -30, 9),        // through the door, into the dark
  sleepSpot: new THREE.Vector3(32, -46, 17),      // his bed beside the altar, in candle glow
  // the stair route: z stays ABOVE the steps quad (z=20) for the FULL height of
  // the staircase (steps top edge is y=-52), then crosses the platform to the door
  climb1: new THREE.Vector3(0, -80, 24.5),
  climb2: new THREE.Vector3(0, -50, 21.5),
  climb3: new THREE.Vector3(-26, -44, 14),
  candleL: new THREE.Vector3(-62, -55, 24),
  candleR: new THREE.Vector3(60, -55, 24),
  sweepA: new THREE.Vector3(-80, -95, 26),
  sweepB: new THREE.Vector3(-15, -95, 26),       // clear of the sand bed AND the orange spirit's spot
  sandEdge: new THREE.Vector3(38, -100, 26),     // admires the rake lines from the edge
  homeCorner: new THREE.Vector3(-93, -98, 26),   // where he stood in the art, broom at hand
};

// the purple hooded spirit from the source art IS the keeper
const KEEPER_W = 96 * S;  // ~25.2 virtual px
const KEEPER_H = 75 * S;  // ~19.7

export class ClaudingView {
  mesh: THREE.Mesh;
  private broom: THREE.Mesh;
  private frame: Frame = 'idle';
  private facing = 1;
  private target: THREE.Vector3 | null = null;
  private queue: THREE.Vector3[] = [];
  onArrive: (() => void) | null = null;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(KEEPER_W, KEEPER_H),
      new THREE.MeshLambertMaterial({ map: loadTex('mask_purple'), transparent: true, alphaTest: 0.01 }),
    );
    this.mesh.position.copy(SPOTS.homeCorner);

    this.broom = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 15),
      new THREE.MeshLambertMaterial({ map: loadTex('broom'), transparent: true, alphaTest: 0.01 }),
    );
    this.broom.position.set(KEEPER_W * 0.46, -3, 0.5); // held at his side, bristles down
    this.broom.visible = false;
    this.mesh.add(this.broom);
  }

  setFrame(f: Frame) {
    this.frame = f;
    const m = this.mesh;
    m.scale.set(this.facing, 1, 1);
    m.rotation.z = 0;
    if (f === 'bow') { m.scale.y = 0.8; m.rotation.z = 0.12 * this.facing; }
    if (f === 'sleep') { m.scale.y = 0.86; m.rotation.z = 0.08; }
  }

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
      if (Math.abs(d.x) > 0.5) this.facing = d.x < 0 ? -1 : 1;
      p.add(d.setLength(step));
      // little waddle instead of a walk cycle — he's a spirit, not a person
      this.mesh.scale.set(this.facing, 1, 1);
      this.mesh.rotation.z = Math.sin(t * 8) * 0.06;
      if (this.broom.visible) this.broom.rotation.z = Math.sin(t * 8) * 0.18; // sweep-sweep
    }
  }

  /** Ambient behavior per activity when not walking; call each frame. */
  ambient(activity: Activity, t: number) {
    this.broom.visible = activity === 'sweeping' || activity === 'tending';
    if (this.busy || activity === 'ceremony') return;
    if (activity === 'sleeping') {
      if (this.frame !== 'sleep') {
        // walk up to bed like an honest spirit — no teleporting
        this.walkTo(SPOTS.climb1, SPOTS.climb2, SPOTS.sleepSpot);
        this.onArrive = () => this.setFrame('sleep');
      }
      return;
    }
    const slot = Math.floor(t);
    if (slot === this.lastSlot) return;
    this.lastSlot = slot;
    if (activity === 'sweeping' && slot % 9 === 0) {
      this.walkTo(Math.random() < 0.5 ? SPOTS.sweepA : SPOTS.sweepB);
    } else if (activity === 'lighting-candles' && slot % 12 === 0) {
      this.walkTo(Math.random() < 0.5 ? SPOTS.candleL : SPOTS.candleR);
    } else if (activity === 'tending' && slot % 15 === 0) {
      this.walkTo(Math.random() < 0.5 ? SPOTS.sandEdge : SPOTS.homeCorner);
    } else if (activity === 'idle') {
      if (this.frame !== 'idle') this.setFrame('idle');
      if (slot % 40 === 0) this.walkTo(SPOTS.homeCorner); // drifts back to his corner
    }
  }
  private lastSlot = -1;
}
