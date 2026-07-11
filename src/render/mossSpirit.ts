import * as THREE from 'three';
import { loadTex } from './scene';

/**
 * Hotaru (蛍, "firefly") — my own mark on the shrine, sibling to Sora.
 * Named for the light he carries: he sleeps curled at the foot of the tree
 * through the day, and wakes at dusk to dart in short, playful hops, leaving
 * a trail of firefly glow behind him. Where Sora is tall and dreamy, he's
 * round, squat, and restless. Greet him and he flares up, delighted.
 * Nothing here speaks.
 */

type Mode = 'sleep' | 'flit';

export class MossSpirit {
  group = new THREE.Group();
  private mesh: THREE.Mesh;
  private sparks = new THREE.Group();
  private floating: { m: THREE.Mesh; born: number; life: number; vx: number; vy: number }[] = [];

  private home: THREE.Vector3;
  private mode: Mode = 'sleep';
  private facing = 1;
  private baseY: number;

  private targetX: number;
  private targetY: number;
  private hopStart = 0;
  private nextHopAt = 0;
  private nextGlowAt = 0;
  private hopUntil = 0;
  private landed = true;

  constructor(home: THREE.Vector3) {
    this.home = home.clone();
    this.baseY = home.y;
    this.targetX = home.x;
    this.targetY = home.y;

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 16),
      new THREE.MeshLambertMaterial({ map: loadTex('spirit_moss'), transparent: true, alphaTest: 0.01 }),
    );
    this.mesh.position.copy(home);
    this.group.add(this.mesh);
    this.group.add(this.sparks);
  }

  /** Scene point → true if he was greeted (a happy flare, day or night). */
  pokeAt(p: { x: number; y: number }, t: number): boolean {
    const d = this.mesh.position;
    if (Math.abs(p.x - d.x) < 10 && Math.abs(p.y - d.y) < 11) {
      this.hopUntil = t + 0.4;
      this.glow(t, true);
      this.glow(t + 0.05, true);
      return true;
    }
    return false;
  }

  /** A landing spark (dim, brief — a footprint of light) or a drifting one (a firefly proper). */
  private glow(t: number, drifting: boolean) {
    const d = this.mesh.position;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(drifting ? 6 : 4, drifting ? 6 : 4),
      new THREE.MeshBasicMaterial({ map: loadTex('firefly_glow'), transparent: true, opacity: 1, depthWrite: false }),
    );
    m.position.set(d.x + (Math.random() * 6 - 3), d.y + (drifting ? 6 : 1), d.z + 1);
    this.sparks.add(m);
    this.floating.push({
      m, born: t,
      life: drifting ? 1.8 + Math.random() * 1.2 : 0.5 + Math.random() * 0.3,
      vx: drifting ? (Math.random() * 2 - 1) * 5 : 0,
      vy: drifting ? 3 + Math.random() * 3 : 0,
    });
  }

  update(dt: number, t: number, active: boolean) {
    for (const f of [...this.floating]) {
      const age = t - f.born;
      f.m.position.x += f.vx * dt;
      f.m.position.y += f.vy * dt;
      (f.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - age / f.life);
      if (age > f.life) { this.sparks.remove(f.m); this.floating.splice(this.floating.indexOf(f), 1); }
    }

    if (active && this.mode === 'sleep') { this.mode = 'flit'; this.nextHopAt = t + 0.3; }
    else if (!active && this.mode === 'flit') {
      this.mode = 'sleep';
      this.mesh.position.set(this.home.x, this.home.y, this.home.z);
    }

    const hopping = t < this.hopUntil;

    if (this.mode === 'sleep') {
      const breathe = Math.sin(t * 0.9) * 0.4;
      this.mesh.rotation.z = hopping ? 0 : 0.32;
      this.mesh.scale.set(1, hopping ? 1 : 0.72, 1);
      this.mesh.position.y = this.baseY - 1.5 + (hopping ? Math.abs(Math.sin((this.hopUntil - t) * 14)) * 2.5 : breathe * 0.15);
      return;
    }

    // flit: short restless hops within a tight patch, a glow left where he lands
    this.mesh.rotation.z = 0;
    if (t >= this.nextHopAt) {
      this.targetX = this.home.x + (Math.random() * 2 - 1) * 15;
      this.targetY = this.home.y + (Math.random() * 2 - 1) * 7;
      this.hopStart = t;
      this.nextHopAt = t + 0.35 + Math.random() * 1.1;
      this.landed = false;
      const dir = Math.sign(this.targetX - this.mesh.position.x) || this.facing;
      this.facing = dir;
      this.mesh.scale.x = Math.abs(this.mesh.scale.x) * dir;
    }
    const k = Math.min(1, (t - this.hopStart) / 0.32);
    this.mesh.scale.y = 1;
    this.mesh.position.x += (this.targetX - this.mesh.position.x) * Math.min(1, dt * 6);
    this.mesh.position.y = this.targetY + Math.sin(k * Math.PI) * 3.2
      + (hopping ? Math.abs(Math.sin((this.hopUntil - t) * 14)) * 2.5 : 0);
    if (k >= 1 && !this.landed) { this.landed = true; this.glow(t, false); } // just landed

    if (t > this.nextGlowAt) { this.glow(t, true); this.nextGlowAt = t + 2.0 + Math.random() * 2.2; }
  }
}
