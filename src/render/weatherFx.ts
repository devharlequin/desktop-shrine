import * as THREE from 'three';
import { VIRTUAL_W, VIRTUAL_H } from './renderer';
import { windAt } from './wind';
import { loadTex } from './scene';

/** The weather you asked for: rain clouds, rain streaks and wind wisps that
 *  appear when their murmur is playing, and fade politely when it stops. */

/** Low grey-lavender rain clouds that roll in high across the sky with the
 *  rain, riding the wind, and drift off when it stops. */
export class Clouds {
  group = new THREE.Group();
  private cl: { m: THREE.Mesh; vx: number; vy: number; speed: number; w: number }[] = [];
  private fade = 0;

  constructor() {
    // a few clouds of varied size, strung across the top band of sky
    const defs = [
      { tex: 'cloud2', w: 50, h: 18 },
      { tex: 'cloud1', w: 34, h: 15 },
      { tex: 'cloud3', w: 40, h: 16 },
      { tex: 'cloud1', w: 30, h: 13 },
    ];
    defs.forEach((d, i) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(d.w, d.h),
        new THREE.MeshBasicMaterial({ map: loadTex(d.tex), transparent: true, opacity: 0, depthWrite: false }),
      );
      this.group.add(m);
      this.cl.push({
        m,
        vx: (i / defs.length) * VIRTUAL_W + Math.random() * 36,
        vy: 18 + i * 11 + Math.random() * 6, // the high band of sky, above the roof
        speed: 4 + Math.random() * 4,
        w: d.w,
      });
    });
    this.group.visible = false;
  }

  update(dt: number, t: number, on: boolean) {
    this.fade = Math.max(0, Math.min(1, this.fade + (on ? dt / 2.5 : -dt / 2)));
    this.group.visible = this.fade > 0.001;
    if (!this.group.visible) return;
    const drift = 3 + Math.max(0, windAt(t)) * 5; // clouds ride the wind, slowly
    for (const c of this.cl) {
      c.vx += (c.speed * 0.4 + drift) * dt;
      if (c.vx - c.w / 2 > VIRTUAL_W) c.vx = -c.w / 2 - Math.random() * 30; // wrap back off the left
      c.m.position.set(c.vx - VIRTUAL_W / 2, VIRTUAL_H / 2 - c.vy, 28); // behind the rain streaks (z=32)
      (c.m.material as THREE.MeshBasicMaterial).opacity = this.fade * 0.88;
    }
  }
}

/** Thin falling streaks across the whole diorama, leaning with the wind. */
export class RainFx {
  group = new THREE.Group();
  private drops: { m: THREE.Mesh; vx: number; vy: number; speed: number; dim: number }[] = [];
  private fade = 0;

  constructor(count = 46) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 4 + Math.random() * 3),
        new THREE.MeshBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0 }),
      );
      this.group.add(m);
      this.drops.push({
        m,
        vx: Math.random() * VIRTUAL_W,
        vy: Math.random() * VIRTUAL_H,
        speed: 140 + Math.random() * 100,
        dim: 0.55 + Math.random() * 0.45, // some drops are shyer than others
      });
    }
    this.group.visible = false;
  }

  update(dt: number, t: number, on: boolean) {
    this.fade = Math.max(0, Math.min(1, this.fade + (on ? dt / 2 : -dt / 1.5)));
    this.group.visible = this.fade > 0;
    if (!this.group.visible) return;
    const slant = 10 + windAt(t) * 16;
    for (const d of this.drops) {
      d.vy += d.speed * dt;
      d.vx += slant * dt;
      if (d.vy > VIRTUAL_H + 4) {
        d.vy = -6;
        d.vx = Math.random() * VIRTUAL_W;
      }
      if (d.vx > VIRTUAL_W) d.vx -= VIRTUAL_W;
      d.m.rotation.z = -slant / 160; // lean into the fall
      d.m.position.set(d.vx - VIRTUAL_W / 2, VIRTUAL_H / 2 - d.vy, 32);
      (d.m.material as THREE.MeshBasicMaterial).opacity = this.fade * 0.3 * d.dim;
    }
  }
}

/** A few pale wisps riding the gusts — the wind made briefly visible. */
export class WindWisps {
  group = new THREE.Group();
  private wisps: { ms: THREE.Mesh[]; vx: number; vy: number; phase: number; speed: number }[] = [];
  private fade = 0;

  constructor(count = 4) {
    for (let i = 0; i < count; i++) {
      // each wisp is a short trail of three fading dashes
      const ms: THREE.Mesh[] = [];
      for (let s = 0; s < 3; s++) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(7 - s * 2, 1),
          new THREE.MeshBasicMaterial({ color: 0xd8dee8, transparent: true, opacity: 0 }),
        );
        this.group.add(m);
        ms.push(m);
      }
      this.wisps.push({
        ms,
        vx: Math.random() * VIRTUAL_W,
        vy: 20 + Math.random() * 130, // the open sky, above the garden floor
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.5,
      });
    }
    this.group.visible = false;
  }

  update(dt: number, t: number, on: boolean) {
    this.fade = Math.max(0, Math.min(1, this.fade + (on ? dt / 2 : -dt / 1.5)));
    this.group.visible = this.fade > 0;
    if (!this.group.visible) return;
    const w = windAt(t);
    for (const wsp of this.wisps) {
      wsp.vx += (26 + Math.max(0, w) * 44) * wsp.speed * dt;
      if (wsp.vx > VIRTUAL_W + 24) {
        wsp.vx = -24;
        wsp.vy = 20 + Math.random() * 130;
        wsp.phase = Math.random() * Math.PI * 2;
      }
      const bob = Math.sin(t * 1.1 * wsp.speed + wsp.phase) * 5;
      wsp.ms.forEach((m, s) => {
        const trail = s * 6; // the dashes follow their leader
        m.position.set(
          wsp.vx - trail - VIRTUAL_W / 2,
          VIRTUAL_H / 2 - (wsp.vy + bob + Math.sin(t * 1.1 * wsp.speed + wsp.phase - s * 0.7) * 2),
          32,
        );
        m.rotation.z = Math.cos(t * 1.1 * wsp.speed + wsp.phase - s * 0.5) * 0.15;
        (m.material as THREE.MeshBasicMaterial).opacity =
          this.fade * (0.16 - s * 0.045) * (0.6 + 0.4 * Math.abs(w));
      });
    }
  }
}
