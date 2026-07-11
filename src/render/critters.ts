import * as THREE from 'three';
import { loadTex } from './scene';

export type CritterKind = 'cat' | 'mask';

interface Critter {
  mesh: THREE.Mesh;
  kind: CritterKind;
  home: THREE.Vector3;
  range: number;         // how far from home it may wander (x)
  mode: 'idle' | 'walk' | 'hop' | 'slump' | 'petted' | 'trek' | 'cuddle';
  slumpUntil: number;
  targetX: number;
  nextAt: number;        // t when the next action may begin
  hopStart: number;
  facing: number;        // 1 | -1
  /** something precious carried overhead; set down while resting */
  item?: THREE.Mesh;
  /** waypoint queue for multi-leg journeys (the cat's bedtime pilgrimage) */
  waypoints: THREE.Vector3[];
  cuddling: boolean;     // reached the keeper's bedside tonight
}

/** The cat's route up to the keeper's bedside (and back down at dawn).
 *  Same rule as the keeper's climb: stay in front of the steps quad (z=20)
 *  until past its top edge (y=-52), only then step down in depth. */
const BEDSIDE_ROUTE = [
  new THREE.Vector3(-5, -88, 24.6),
  new THREE.Vector3(32, -50, 21.6),
  new THREE.Vector3(47, -49, 20.7), // stays above the steps quad — the platform face is part of it
];

/** The garden's small residents: the cat wanders and lounges, the masked
 *  spirits hop and look around. Sparse by design — mostly they are still. */
export class Critters {
  hearts = new THREE.Group();
  private cs: Critter[] = [];
  private floating: { m: THREE.Mesh; born: number }[] = [];

  /** Pet whatever is under the pointer (scene coords). Returns true if something purred. */
  petAt(p: { x: number; y: number }, t: number): boolean {
    for (const c of this.cs) {
      if (c.kind !== 'cat') continue; // only the cat suffers affection, for now
      const d = c.mesh.position;
      if (Math.abs(p.x - d.x) < 15 && Math.abs(p.y - d.y) < 11) {
        c.mode = 'petted';
        c.hopStart = t;
        c.slumpUntil = t + 2.6;
        c.mesh.userData.petBaseY = d.y; // pet him wherever he is — even at the bedside
        this.spawnHeart(d, t);
        return true;
      }
    }
    return false;
  }

  /** True if the cat is under this scene point (for the paw cursor). */
  catAt(p: { x: number; y: number }): boolean {
    return this.cs.some(c => c.kind === 'cat'
      && Math.abs(p.x - c.mesh.position.x) < 15 && Math.abs(p.y - c.mesh.position.y) < 11);
  }

  private spawnHeart(at: THREE.Vector3, t: number) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 5),
      new THREE.MeshBasicMaterial({ map: loadTex('heart'), transparent: true }),
    );
    m.position.set(at.x + (Math.random() * 8 - 4), at.y + 10, at.z + 1);
    this.hearts.add(m);
    this.floating.push({ m, born: t });
  }

  add(mesh: THREE.Mesh | undefined, kind: CritterKind, range: number, item?: THREE.Mesh) {
    if (!mesh) return;
    this.cs.push({
      mesh, kind, range,
      home: mesh.position.clone(),
      mode: 'idle',
      targetX: mesh.position.x,
      nextAt: 4 + Math.random() * 20,
      hopStart: 0,
      facing: 1,
      slumpUntil: 0,
      item,
      waypoints: [],
      cuddling: false,
    });
  }

  update(t: number, dt: number, night = false) {
    for (const h of [...this.floating]) {
      const age = t - h.born;
      h.m.position.y += 6 * dt;
      (h.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - age / 1.6);
      if (age > 1.6) {
        this.hearts.remove(h.m);
        this.floating.splice(this.floating.indexOf(h), 1);
      }
    }
    for (const c of this.cs) {
      // the carried treasure: overhead normally, set gently on the ground while resting
      if (c.item) {
        const p = c.mesh.position;
        if (c.mode === 'slump') {
          const k = Math.min(1, (t - c.hopStart) / 1.5);
          c.item.position.set(
            p.x + (11 + 3 * k) * c.facing,
            p.y + (11 - 18 * k),          // lowered from overhead down to the ground
            p.z + 1,
          );
          c.item.rotation.z = 0.15 * k;
        } else {
          c.item.position.set(p.x, p.y + 15.5, p.z + 1); // held high between his little arms
          c.item.rotation.z = 0;
        }
      }
      // the cat's bedtime: at night it climbs to the keeper's bedside; at dawn it comes home
      if (c.kind === 'cat' && c.mode === 'idle' && t >= c.nextAt) {
        if (night && !c.cuddling) {
          c.mode = 'trek';
          c.waypoints = [...BEDSIDE_ROUTE];
        } else if (!night && c.cuddling) {
          c.mode = 'trek';
          c.waypoints = [...BEDSIDE_ROUTE].reverse().slice(1).concat([c.home.clone()]);
          c.cuddling = false;
        }
      }
      if (c.mode === 'trek') {
        const wp = c.waypoints[0];
        if (!wp) {
          if (night) { c.mode = 'cuddle'; c.cuddling = true; this.spawnHeart(c.mesh.position, t); }
          else { c.mode = 'idle'; c.nextAt = t + 10 + Math.random() * 20; }
          continue;
        }
        const d = wp.clone().sub(c.mesh.position);
        const step = 9 * dt;
        if (d.length() <= step) {
          c.mesh.position.copy(wp);
          c.waypoints.shift();
        } else {
          if (Math.abs(d.x) > 0.5) {
            c.facing = d.x < 0 ? -1 : 1;
            c.mesh.scale.x = Math.abs(c.mesh.scale.x) * c.facing;
          }
          c.mesh.position.add(d.setLength(step));
        }
        continue;
      }
      if (c.mode === 'cuddle') {
        if (!night) { c.nextAt = t; c.mode = 'idle'; continue; } // dawn: idle will start the trek home
        c.mesh.scale.y = 1 - 0.04 * Math.abs(Math.sin(t * 1.1)); // slow sleepy breathing
        continue;
      }
      if (c.mode === 'idle') {
        if (t < c.nextAt) continue;
        if (c.kind === 'cat') {
          if (night) continue; // handled above
          c.mode = 'walk';
          c.targetX = c.home.x + (Math.random() * 2 - 1) * c.range;
        } else {
          // spirits mostly hop in place; sometimes turn to look around;
          // sometimes rest their little arms — holding things up all day is hard work
          const roll = Math.random();
          if (roll < 0.3) {
            c.facing *= -1;
            c.mesh.scale.x = Math.abs(c.mesh.scale.x) * c.facing;
            c.nextAt = t + 10 + Math.random() * 30;
          } else if (roll < 0.55) {
            c.mode = 'slump';
            c.hopStart = t; // reuse as slump start for the ease-in
            c.slumpUntil = t + 6 + Math.random() * 12;
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
      } else if (c.mode === 'petted') {
        const baseY = (c.mesh.userData.petBaseY as number) ?? c.home.y;
        if (t >= c.slumpUntil) {
          c.mesh.scale.y = 1;
          c.mesh.position.y = baseY;
          c.mode = c.cuddling ? 'cuddle' : 'idle';
          c.nextAt = t + 8 + Math.random() * 20;
        } else {
          // a happy little squish-and-lean-in
          const k = t - c.hopStart;
          c.mesh.scale.y = 1 - 0.1 * Math.abs(Math.sin(k * 6));
          c.mesh.position.y = baseY + Math.abs(Math.sin(k * 6)) * 0.8;
        }
      } else if (c.mode === 'slump') {
        if (t >= c.slumpUntil) {
          c.mesh.rotation.z = 0;
          c.mesh.scale.y = 1;
          c.mode = 'idle';
          c.nextAt = t + 12 + Math.random() * 30;
        } else {
          // ease into a weary little lean
          const k = Math.min(1, (t - c.hopStart) / 1.5);
          c.mesh.rotation.z = 0.1 * c.facing * k;
          c.mesh.scale.y = 1 - 0.06 * k;
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
