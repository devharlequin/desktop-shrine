import * as THREE from 'three';
import { VIRTUAL_W, VIRTUAL_H } from './renderer';

/** The tree and where its leaves may come to rest. */
export const TREE = {
  x: -178, baseY: -92, w: 64, h: 104,             // scene coords of the tree mesh (full-grown)
  ground: { y0: 228, y1: 250 },                   // where leaves land (virtual px, open foreground)
  steps: { x0: 120, x1: 300, y0: 192, y1: 214 },  // sometimes on the steps
};

const COLORS = [0xb8622e, 0x8a6a2e, 0x6a7a3e];

interface Falling {
  m: THREE.Mesh;
  vx: number;         // virtual coords
  vy: number;
  landY: number;
  sway: number;
  t0: number;
}

/** Leaves loosed from the canopy that sway down and settle into the garden. */
export class FallingLeaves {
  group = new THREE.Group();
  onLand: ((p: { x: number; y: number }) => void) | null = null;
  private falling: Falling[] = [];

  release(now: number, treeScale = 1) {
    // canopy box in virtual coords, scaled about the tree's roots
    const baseVX = TREE.x + VIRTUAL_W / 2;
    const baseVY = VIRTUAL_H / 2 - TREE.baseY;
    const cx = baseVX + (Math.random() * 2 - 1) * 26 * treeScale;
    const vy = baseVY - TREE.h * treeScale * (0.62 + Math.random() * 0.3);
    const vx = cx;
    // wind drifts them rightward; some settle on the steps
    const onSteps = Math.random() < 0.3;
    const landY = onSteps
      ? TREE.steps.y0 + Math.random() * (TREE.steps.y1 - TREE.steps.y0)
      : TREE.ground.y0 + Math.random() * (TREE.ground.y1 - TREE.ground.y0);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 3),
      new THREE.MeshLambertMaterial({ color: COLORS[Math.floor(Math.random() * 3)], transparent: true }),
    );
    this.group.add(m);
    this.falling.push({ m, vx, vy, landY, sway: 1 + Math.random() * 2, t0: now });
  }

  update(dt: number, t: number) {
    for (const f of [...this.falling]) {
      f.vy += 9 * dt;                                   // gentle fall
      f.vx += (Math.sin(t * f.sway) * 6 + 4) * dt;      // sway + steady rightward wind
      f.m.rotation.z = Math.sin(t * f.sway * 1.7) * 0.6;
      f.m.position.set(f.vx - VIRTUAL_W / 2, VIRTUAL_H / 2 - f.vy, 31);
      if (f.vy >= f.landY) {
        this.group.remove(f.m);
        this.falling.splice(this.falling.indexOf(f), 1);
        this.onLand?.({ x: f.vx, y: f.landY });
      }
    }
  }
}
