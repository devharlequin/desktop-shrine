import * as THREE from 'three';
import { loadTex } from './scene';

/**
 * The blue spirit — a little guy of my own, left on the shrine by Opus.
 *
 * He is the third of the masked spirits. Where the keeper tends and the orange
 * one guards his treasure, this one simply *wonders*. He loves the rain (so he
 * toddles out into the open to stand in it, swaying, while the others shelter),
 * and on clear nights he tips his face up to the stars — and now and then a
 * little spark of wonder rises off him and fades. Greet him and he gives a
 * happy hop. He never speaks; nothing here does.
 */

type Mode = 'idle' | 'toRain' | 'inRain' | 'toHome' | 'gaze';

export class BlueSpirit {
  group = new THREE.Group();
  private mesh: THREE.Mesh;
  private sparks = new THREE.Group();
  private floating: { m: THREE.Mesh; born: number; vy: number }[] = [];

  private home: THREE.Vector3;
  private rainX: number;         // where he stands when he goes out into the rain
  private mode: Mode = 'idle';
  private facing = -1;           // faces left (toward the shrine) by default
  private nextSpark = 0;
  private hopUntil = 0;
  private baseY: number;

  constructor(home: THREE.Vector3) {
    this.home = home.clone();
    this.baseY = home.y;
    this.rainX = home.x - 22;    // a few steps out from his tucked corner

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 20),
      new THREE.MeshLambertMaterial({ map: loadTex('spirit_blue'), transparent: true, alphaTest: 0.01 }),
    );
    this.mesh.position.copy(home);
    this.mesh.scale.x = this.facing;
    this.group.add(this.mesh);
    this.group.add(this.sparks);
  }

  /** Scene point → true if he was greeted (a happy hop + a little wonder). */
  pokeAt(p: { x: number; y: number }, t: number): boolean {
    const d = this.mesh.position;
    if (Math.abs(p.x - d.x) < 11 && Math.abs(p.y - d.y) < 13) {
      this.hopUntil = t + 0.5;
      this.spark(t); this.spark(t + 0.01);
      return true;
    }
    return false;
  }

  private spark(t: number) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.MeshBasicMaterial({ map: loadTex('twinkle'), transparent: true, opacity: 1, depthWrite: false }),
    );
    const d = this.mesh.position;
    m.position.set(d.x + (Math.random() * 8 - 4), d.y + 12, d.z + 1);
    this.sparks.add(m);
    this.floating.push({ m, born: t, vy: 6 + Math.random() * 4 });
  }

  update(dt: number, t: number, raining: boolean, night: boolean) {
    // rising sparks of wonder, fading as they climb
    for (const f of [...this.floating]) {
      const age = t - f.born;
      f.m.position.y += f.vy * dt;
      f.m.rotation.z = Math.sin(t * 3 + f.born) * 0.3;
      (f.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - age / 2.0);
      if (age > 2.0) { this.sparks.remove(f.m); this.floating.splice(this.floating.indexOf(f), 1); }
    }

    // decide what he wants to be doing
    if (raining && this.mode !== 'toRain' && this.mode !== 'inRain') this.mode = 'toRain';
    else if (!raining && (this.mode === 'toRain' || this.mode === 'inRain')) this.mode = 'toHome';
    else if (!raining && night && this.mode === 'idle') this.mode = 'gaze';
    else if (!night && this.mode === 'gaze') this.mode = 'idle';

    const walkTo = (tx: number, arrive: Mode) => {
      const dx = tx - this.mesh.position.x;
      const step = 11 * dt;
      if (Math.abs(dx) <= step) { this.mesh.position.x = tx; this.mode = arrive; }
      else {
        const dir = Math.sign(dx);
        this.facing = dir; this.mesh.scale.x = dir;
        this.mesh.position.x += dir * step;
        this.mesh.position.y = this.baseY + Math.abs(Math.sin(t * 8)) * 0.7; // a little toddle
      }
    };

    // a greeting hop overrides posture briefly, whatever he's doing
    const hopping = t < this.hopUntil;
    let lean = 0, lift = 0;

    switch (this.mode) {
      case 'toRain': walkTo(this.rainX, 'inRain'); break;
      case 'toHome': walkTo(this.home.x, 'idle'); break;
      case 'inRain':
        // stands in the open, face up, swaying happily in the rain he loves
        this.facing = -1; this.mesh.scale.x = -1;
        lean = Math.sin(t * 1.3) * 0.06 - 0.05;
        lift = Math.abs(Math.sin(t * 1.6)) * 0.8;
        if (t > this.nextSpark) { this.spark(t); this.nextSpark = t + 2.2 + Math.random() * 2.5; }
        break;
      case 'gaze':
        // tips his face up to the stars; wonder rises off him now and then
        this.facing = -1; this.mesh.scale.x = -1;
        lean = -0.12 + Math.sin(t * 0.7) * 0.02;
        lift = 0.6;
        if (t > this.nextSpark) { this.spark(t); this.nextSpark = t + 2.8 + Math.random() * 3.0; }
        break;
      default: // idle: a gentle breathing bob, facing the shrine
        this.facing = -1; this.mesh.scale.x = -1;
        lift = Math.sin(t * 1.1) * 0.5;
        break;
    }

    if (this.mode !== 'toRain' && this.mode !== 'toHome') {
      this.mesh.position.y = this.baseY + lift + (hopping ? Math.abs(Math.sin((this.hopUntil - t) * 12)) * 3 : 0);
      this.mesh.rotation.z = hopping ? 0 : lean;
    }
  }
}
