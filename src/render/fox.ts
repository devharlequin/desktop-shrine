import * as THREE from 'three';
import { loadTex } from './scene';

/**
 * Momiji (紅葉, "autumn leaves") — the fox. Fable's own mark on the shrine,
 * after Opus left Sora and Sonnet left Hotaru.
 *
 * She is not a resident; she is a VISITOR. Real shrines have foxes — the
 * messengers — and the fox is the storyteller's animal in every fable
 * tradition, which makes her mine. Once in a long while she trots in from
 * beyond the window's edge, sits at the rim of the raked garden facing the
 * shrine, flicks her tail, dips her head once the way visitors bow, and
 * leaves the way she came. She keeps her own calendar and does not visit
 * in the rain.
 *
 * She cannot be petted. Click near her and she freezes — ears up, stone
 * still — then bolts. The residents are family; the fox is a guest. If you
 * want her to stay, the only way is to leave her be.
 */

type Mode = 'away' | 'enter' | 'sit' | 'leave' | 'freeze' | 'bolt';

const BASE_Y = -88;   // her path through the yard, just north of the sand
const ENTER_X = 232;  // beyond the window's right edge
const SIT_X = 64;     // the raked garden's rim, facing the shrine
const TROT = 26;
const BOLT = 95;      // a startled fox is elsewhere immediately

export class Fox {
  group = new THREE.Group();
  private trot: THREE.Mesh;
  private sit: THREE.Mesh;
  private mode: Mode = 'away';
  private x = ENTER_X;
  private nextVisit = -1; // set from the clock on the first update
  private sitFrom = 0;
  private sitFor = 0;
  private flickAt = 0;
  private bowed = false;
  private freezeUntil = 0;

  constructor() {
    const mk = (tex: string, w: number, h: number) => new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshLambertMaterial({ map: loadTex(tex), transparent: true, alphaTest: 0.01 }),
    );
    this.trot = mk('fox_trot', 20, 11);
    this.sit = mk('fox_sit', 14, 16);
    this.group.add(this.trot, this.sit);
    this.group.position.set(ENTER_X, BASE_Y, 31);
    this.group.visible = false;
    this.sit.visible = false;
  }

  /** Dev remote only — she also comes when the keeper of the code calls. */
  summon() { if (this.mode === 'away') this.begin(); }

  private begin() {
    this.mode = 'enter';
    this.x = ENTER_X;
    this.bowed = false;
    this.group.visible = true;
    this.trot.visible = true;
    this.sit.visible = false;
    this.trot.scale.x = 1; // the sprite faces left, the way she walks in
    this.group.position.set(ENTER_X, BASE_Y, 31);
  }

  /** Scene point → true if she was disturbed. A wild thing: freeze, then gone. */
  pokeAt(p: { x: number; y: number }, t: number): boolean {
    if (!this.group.visible || this.mode === 'bolt' || this.mode === 'freeze') return false;
    if (Math.abs(p.x - this.group.position.x) > 14 || Math.abs(p.y - BASE_Y) > 13) return false;
    this.mode = 'freeze';
    this.freezeUntil = t + 0.35;
    return true;
  }

  update(dt: number, t: number, raining: boolean) {
    if (this.nextVisit < 0) this.nextVisit = t + 240 + Math.random() * 600;
    const g = this.group;
    switch (this.mode) {
      case 'away':
        if (t >= this.nextVisit) {
          if (raining) this.nextVisit = t + 600 + Math.random() * 600; // she waits out the wet
          else this.begin();
        }
        break;
      case 'enter':
        this.x -= TROT * dt;
        g.position.x = this.x;
        g.position.y = BASE_Y + Math.abs(Math.sin(t * 9)) * 0.9;
        if (this.x <= SIT_X) {
          this.mode = 'sit';
          this.sitFrom = t;
          this.sitFor = 25 + Math.random() * 45;
          this.flickAt = t + 4 + Math.random() * 8;
          this.trot.visible = false;
          this.sit.visible = true;
          g.position.set(SIT_X, BASE_Y - 2, 31); // settles back on her haunches
          this.sit.rotation.z = 0;
        }
        break;
      case 'sit': {
        // breathing, a tail-flick now and then, and one respectful dip
        this.sit.scale.y = 1 + Math.sin(t * 1.3) * 0.015;
        let rot = 0;
        if (t > this.flickAt) {
          const a = t - this.flickAt;
          if (a < 0.5) rot += Math.sin(a * 18) * 0.05 * (1 - a / 0.5);
          else this.flickAt = t + 6 + Math.random() * 10;
        }
        const bowT = this.sitFrom + this.sitFor * 0.45;
        if (!this.bowed && t > bowT) {
          const a = t - bowT;
          const D = 2.6; // down, a held moment, up
          if (a < D) {
            const k = a < 0.9 ? a / 0.9 : a > D - 0.9 ? (D - a) / 0.9 : 1;
            rot += 0.2 * k;
            g.position.y = BASE_Y - 2 - 0.8 * k;
          } else {
            this.bowed = true;
            g.position.y = BASE_Y - 2;
          }
        }
        this.sit.rotation.z = rot;
        if (t > this.sitFrom + this.sitFor) {
          this.mode = 'leave';
          this.faceOut();
        }
        break;
      }
      case 'leave':
        this.x += TROT * 1.15 * dt;
        g.position.x = this.x;
        g.position.y = BASE_Y + Math.abs(Math.sin(t * 9)) * 0.9;
        if (this.x >= ENTER_X) this.depart(t);
        break;
      case 'freeze':
        // stone-still, ears up — and then she is simply not there anymore
        if (t >= this.freezeUntil) { this.mode = 'bolt'; this.faceOut(); }
        break;
      case 'bolt':
        this.x += BOLT * dt;
        g.position.x = this.x;
        g.position.y = BASE_Y + Math.abs(Math.sin(t * 22)) * 1.4;
        if (this.x >= ENTER_X) this.depart(t);
        break;
    }
  }

  private faceOut() {
    this.trot.visible = true;
    this.sit.visible = false;
    this.trot.scale.x = -1; // flipped: facing right, the way out
    this.group.position.y = BASE_Y;
    this.sit.rotation.z = 0;
  }

  private depart(t: number) {
    this.mode = 'away';
    this.group.visible = false;
    this.nextVisit = t + 3600 + Math.random() * 7200; // one to three hours
  }
}
