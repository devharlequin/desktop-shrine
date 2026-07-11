import * as THREE from 'three';
import { loadTex } from './scene';
import { chimeTinkle } from './sounds';

/** A gentle, gusty wind: layered sines, mostly calm, occasionally insistent. */
export function windAt(t: number): number {
  return (
    0.4 * Math.sin(t * 0.31 + 1.3) +
    0.25 * Math.sin(t * 0.83 + 2.1) +
    0.35 * Math.sin(t * 0.11) * Math.sin(t * 0.53 + 0.7)
  );
}

/** Wind chimes under the eaves. They sway with the wind and, when a gust
 *  moves them enough, ring a soft cluster of notes. */
export class Chimes {
  group = new THREE.Group();
  private chimes: THREE.Mesh[] = [];
  private lastRing = -10;

  constructor(positions: THREE.Vector3[]) {
    for (const p of positions) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(9 * 0.8, 17 * 0.8).translate(0, -17 * 0.4, 0), // pivot at hanger
        new THREE.MeshLambertMaterial({ map: loadTex('chime'), transparent: true, alphaTest: 0.01 }),
      );
      m.position.copy(p);
      this.chimes.push(m);
      this.group.add(m);
    }
  }

  update(t: number, dt: number) {
    const w = windAt(t);
    this.chimes.forEach((m, i) => {
      // each chime answers the wind slightly differently
      m.rotation.z = w * 0.28 + Math.sin(t * 2.3 + i * 1.7) * 0.05 * Math.abs(w);
    });
    // a strong gust rings them (with a courteous cooldown)
    if (Math.abs(w) > 0.72 && t - this.lastRing > 7 && Math.random() < dt * 1.5) {
      this.lastRing = t;
      chimeTinkle(Math.abs(w));
    }
  }
}
