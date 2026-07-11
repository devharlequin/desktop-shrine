import * as THREE from 'three';

export type CritterKind = 'cat' | 'mask';

interface Critter {
  mesh: THREE.Mesh;
  kind: CritterKind;
  home: THREE.Vector3;
  range: number;         // how far from home it may wander (x)
  mode: 'idle' | 'walk' | 'hop';
  targetX: number;
  nextAt: number;        // t when the next action may begin
  hopStart: number;
  facing: number;        // 1 | -1
}

/** The garden's small residents: the cat wanders and lounges, the masked
 *  spirits hop and look around. Sparse by design — mostly they are still. */
export class Critters {
  private cs: Critter[] = [];

  add(mesh: THREE.Mesh | undefined, kind: CritterKind, range: number) {
    if (!mesh) return;
    this.cs.push({
      mesh, kind, range,
      home: mesh.position.clone(),
      mode: 'idle',
      targetX: mesh.position.x,
      nextAt: 4 + Math.random() * 20,
      hopStart: 0,
      facing: 1,
    });
  }

  update(t: number, dt: number) {
    for (const c of this.cs) {
      if (c.mode === 'idle') {
        if (t < c.nextAt) continue;
        if (c.kind === 'cat') {
          c.mode = 'walk';
          c.targetX = c.home.x + (Math.random() * 2 - 1) * c.range;
        } else {
          // spirits mostly hop in place; sometimes just turn to look around
          if (Math.random() < 0.35) {
            c.facing *= -1;
            c.mesh.scale.x = Math.abs(c.mesh.scale.x) * c.facing;
            c.nextAt = t + 10 + Math.random() * 30;
          } else {
            c.mode = 'hop';
            c.hopStart = t;
            c.targetX = c.mesh.position.x + (Math.random() * 2 - 1) * 5;
            c.targetX = Math.min(Math.max(c.targetX, c.home.x - c.range), c.home.x + c.range);
          }
        }
      } else if (c.mode === 'walk') {
        const dx = c.targetX - c.mesh.position.x;
        const dir = Math.sign(dx) || 1;
        if (dir !== c.facing) {
          c.facing = dir;
          c.mesh.scale.x = Math.abs(c.mesh.scale.x) * dir;
        }
        const step = 7 * dt; // an unhurried cat
        if (Math.abs(dx) <= step) {
          c.mesh.position.x = c.targetX;
          c.mesh.position.y = c.home.y;
          c.mode = 'idle';
          c.nextAt = t + 18 + Math.random() * 50; // long lounges between strolls
        } else {
          c.mesh.position.x += dir * step;
          c.mesh.position.y = c.home.y + Math.abs(Math.sin(t * 7)) * 0.6; // soft amble
        }
      } else if (c.mode === 'hop') {
        const k = (t - c.hopStart) / 0.38;
        if (k >= 1) {
          c.mesh.position.set(c.targetX, c.home.y, c.home.z);
          c.mode = 'idle';
          c.nextAt = t + 12 + Math.random() * 35;
        } else {
          c.mesh.position.x += (c.targetX - c.mesh.position.x) * 0.2;
          c.mesh.position.y = c.home.y + Math.sin(k * Math.PI) * 2.5;
        }
      }
    }
  }
}
