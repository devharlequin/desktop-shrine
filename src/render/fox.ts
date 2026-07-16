import * as THREE from 'three';
import { loadTex } from './scene';
import { FOX_TAME, FOX_GIVES, rollGift, type GiftKind } from '../core/garden';

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
 * She cannot be petted — at first. A wild thing decides about you slowly.
 * Every visit that ends unbothered, she remembers; every fright, she also
 * remembers, and those weigh double. As trust grows she sits a little
 * nearer, stays a little longer, comes a little more often, and a click
 * landing NEAR her stops meaning danger. After enough patient weeks, a
 * touch on her actual fur is — once per visit — suffered: she goes still
 * and leans into it, the way a wild thing accepts what it has decided to
 * accept. The second touch still spooks her. Trust is not tameness.
 *
 * There is a dish at the garden rim now. Leave a morsel out and she will
 * stop to eat before she sits — and a fed fox decides about you faster.
 * Once she trusts, she pays her debts the way crows do: some visits she
 * arrives carrying something small and shiny, and leaves it by the dish.
 */

type Mode = 'away' | 'enter' | 'eat' | 'sit' | 'leave' | 'cross' | 'freeze' | 'bolt' | 'accept';

const BASE_Y = -88;   // her path through the yard, just north of the sand
const ENTER_X = 232;  // beyond the window's right edge
const SIT_X = 64;     // where she sat as a stranger — the garden's far rim
const SIT_X_NEAR = 50; // where trust lets her settle (clear of the sand bed)
export const DISH_X = 92; // the offering dish, on her way in
const TROT = 26;
const BOLT = 95;      // a startled fox is elsewhere immediately
const EAT_TIME = 5.4; // unhurried; a fox does not gulp

export class Fox {
  group = new THREE.Group();
  /** How far she has come to trust the keeper of this yard. Set from the
   *  garden save at launch; main.ts keeps it current between visits. */
  trust = 0;
  /** A visit ended: true if she bolted, false if she left in peace.
   *  Calm departures fire only if she truly sat; frights always fire. */
  onVisitEnd?: (startled: boolean) => void;
  /** Is a morsel out on the dish? Asked as each visit begins. */
  hasFood?: () => boolean;
  /** She finished the morsel. */
  onAte?: () => void;
  /** She left something by the dish. */
  onGift?: (kind: GiftKind) => void;
  /** Dev remote only: guarantee the next visit's carry roll. */
  forceGift = false;
  /** Is it night? Asked when she decides how to leave. */
  isNight?: () => boolean;
  /** A paw pressed down at scene point p (her feet, not her center). */
  onPrint?: (p: { x: number; y: number }) => void;
  /** Dev remote only: guarantee the next sit ends in a crossing, quickly. */
  forceCross = false;

  private trot: THREE.Mesh;
  private sit: THREE.Mesh;
  private carry: THREE.Mesh; // the gift, held in her mouth
  private mode: Mode = 'away';
  private x = ENTER_X;
  private nextVisit = -1; // set from the clock on the first update
  private sitX = SIT_X;
  private sitFrom = 0;
  private sitFor = 0;
  private flickAt = 0;
  private bowed = false;
  private freezeUntil = 0;
  private sat = false;        // reached her spot this visit (a visit worth remembering)
  private touched = false;    // already accepted one touch this visit
  private acceptFrom = 0;
  private acceptLean = 0;     // which way she leans: toward the hand
  private eating = false;     // a morsel was out when this visit began
  private ate = false;        // and she has finished it
  private eatFrom = 0;
  private carrying: GiftKind | null = null;
  private py = BASE_Y;        // path y while crossing the garden
  private sincePrint = 0;     // distance walked since the last paw print

  constructor() {
    const mk = (tex: string, w: number, h: number) => new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshLambertMaterial({ map: loadTex(tex), transparent: true, alphaTest: 0.01 }),
    );
    this.trot = mk('fox_trot', 20, 11);
    this.sit = mk('fox_sit', 14, 16);
    this.carry = mk('gift_button', 5, 5); // texture swapped per gift
    this.carry.position.set(-9, -2, 0.5);  // at her mouth, nose-side
    this.trot.add(this.carry);
    this.carry.visible = false;
    this.group.add(this.trot, this.sit);
    this.group.position.set(ENTER_X, BASE_Y, 31);
    this.group.visible = false;
    this.sit.visible = false;
  }

  /** Dev remote only — she also comes when the keeper of the code calls. */
  summon() { if (this.mode === 'away') this.begin(); }

  /** 0..1 — how much of the way to trusting she has come. */
  private warmth() { return Math.min(1, this.trust / FOX_TAME); }

  private begin() {
    this.mode = 'enter';
    this.x = ENTER_X;
    this.py = BASE_Y;
    this.bowed = false;
    this.sat = false;
    this.touched = false;
    this.ate = false;
    this.eating = !!this.hasFood?.();
    this.sitX = SIT_X - (SIT_X - SIT_X_NEAR) * this.warmth(); // nearer, as she dares
    // the crow's bargain: a trusted, fed fox sometimes arrives carrying
    this.carrying = this.eating && this.trust >= FOX_GIVES
      && (this.forceGift || Math.random() < 0.3) ? rollGift() : null;
    this.forceGift = false;
    if (this.carrying) {
      (this.carry.material as THREE.MeshLambertMaterial).map = loadTex('gift_' + this.carrying);
      (this.carry.material as THREE.MeshLambertMaterial).needsUpdate = true;
    }
    this.carry.visible = !!this.carrying;
    this.group.visible = true;
    this.trot.visible = true;
    this.sit.visible = false;
    this.trot.scale.x = 1; // the sprite faces left, the way she walks in
    this.group.position.set(ENTER_X, BASE_Y, 31);
  }

  /** Scene point → true if the click was hers (a startle — or, one day, not). */
  pokeAt(p: { x: number; y: number }, t: number): boolean {
    if (!this.group.visible || this.mode === 'bolt' || this.mode === 'freeze'
      || this.mode === 'accept') return false;
    const dx = Math.abs(p.x - this.group.position.x);
    const dy = Math.abs(p.y - this.group.position.y); // wherever she stands, not just her home row
    if (dx > 14 || dy > 13) return false;
    // trust narrows what counts as an alarm: a stranger's fox spooks at
    // anything within reach; a trusted keeper must nearly touch her
    const alarm = 14 - 8 * this.warmth(); // 14 → 6
    const onHer = dx <= 7 && dy <= 9;     // the hand is on her actual fur
    if (this.trust >= FOX_TAME && onHer && !this.touched && this.mode === 'sit') {
      // the decided-upon thing: she goes still and suffers the hand, once
      this.mode = 'accept';
      this.touched = true;
      this.acceptFrom = t;
      this.acceptLean = p.x < this.group.position.x ? 1 : -1; // toward it
      return true;
    }
    if (!onHer && dx > alarm) return false; // near, but she has seen worse
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
      case 'enter': {
        this.x -= TROT * dt;
        g.position.x = this.x;
        g.position.y = BASE_Y + Math.abs(Math.sin(t * 9)) * 0.9;
        const stopAt = this.eating && !this.ate ? DISH_X : this.sitX;
        if (this.x <= stopAt) {
          if (this.eating && !this.ate) {
            this.mode = 'eat';
            this.eatFrom = t;
            g.position.set(DISH_X, BASE_Y, 31);
          } else {
            this.mode = 'sit';
            this.sat = true;
            this.sitFrom = t;
            // a trusted yard is worth lingering in: up to ~3 minutes
            this.sitFor = 25 + Math.random() * 45 + 110 * this.warmth();
            if (this.forceCross) this.sitFor = 5; // dev: don't make me wait
            this.flickAt = t + 4 + Math.random() * 8;
            this.trot.visible = false;
            this.sit.visible = true;
            g.position.set(this.sitX, BASE_Y - 2, 31); // settles back on her haunches
            this.sit.rotation.z = 0;
          }
        }
        break;
      }
      case 'eat': {
        const a = t - this.eatFrom;
        // first, if she brought something: nose down once, and it is given
        if (this.carrying && a > 0.7) {
          this.onGift?.(this.carrying);
          this.carrying = null;
          this.carry.visible = false;
        }
        // unhurried bites: nose dipping to the dish and lifting to watch
        const dip = Math.max(0, Math.sin(a * 3.1));
        this.trot.rotation.z = 0.22 * dip; // left-facing: nose sinks with +z
        g.position.y = BASE_Y - 0.6 * dip;
        if (a >= EAT_TIME) {
          this.trot.rotation.z = 0;
          g.position.y = BASE_Y;
          this.ate = true;
          this.onAte?.();
          this.mode = 'enter'; // and on to her sitting spot
        }
        break;
      }
      case 'sit': {
        // breathing, a tail-flick now and then, and one respectful dip
        this.sit.scale.y = 1 + Math.sin(t * 1.3) * 0.015;
        let rot = 0;
        if (t > this.flickAt) {
          const a = t - this.flickAt;
          if (a < 0.5) rot += Math.sin(a * 18) * 0.05 * (1 - a / 0.5);
          else this.flickAt = t + 6 + Math.random() * 10;
        }
        const bowT = this.sitFrom + Math.min(this.sitFor * 0.45, 32);
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
          // by night, once this yard feels half hers, she sometimes goes home
          // THROUGH the garden instead of around it — paws in the raked sand
          const crosses = this.forceCross
            || (!!this.isNight?.() && this.trust >= 3 && Math.random() < 0.5);
          this.forceCross = false;
          this.mode = crosses ? 'cross' : 'leave';
          this.faceOut();
          this.py = BASE_Y;
          this.sincePrint = 0;
        }
        break;
      }
      case 'cross': {
        // down and across the sand, then out the way of the rising sun
        const tgt = this.x < 152 ? { x: 152, y: -116 } : { x: ENTER_X + 8, y: -116 };
        const dx = tgt.x - this.x, dy = tgt.y - this.py;
        const d = Math.hypot(dx, dy) || 1;
        const step = TROT * dt;
        this.x += (dx / d) * step;
        this.py += (dy / d) * step;
        g.position.x = this.x;
        g.position.y = this.py + Math.abs(Math.sin(t * 9)) * 0.9;
        this.sincePrint += step;
        if (this.sincePrint >= 5) {
          this.sincePrint = 0;
          this.onPrint?.({ x: this.x, y: this.py - 5 }); // at her feet
        }
        if (this.x >= ENTER_X) { this.py = BASE_Y; this.depart(t, false); }
        break;
      }
      case 'accept': {
        // stone-still by choice this time: a slow lean into the hand, a long
        // blink you can't see, and back to her watch as if nothing happened
        const a = t - this.acceptFrom;
        const D = 2.2;
        const k = a < 0.7 ? a / 0.7 : a > D - 0.7 ? Math.max(0, (D - a) / 0.7) : 1;
        this.sit.rotation.z = -0.12 * k * this.acceptLean;
        this.sit.scale.y = 1 - 0.04 * k; // settling lower on her haunches
        if (a >= D) {
          this.mode = 'sit';
          this.sit.rotation.z = 0;
          this.sit.scale.y = 1;
          this.flickAt = t + 1 + Math.random() * 2; // a pleased flick, soon
        }
        break;
      }
      case 'leave':
        this.x += TROT * 1.15 * dt;
        g.position.x = this.x;
        g.position.y = this.py + Math.abs(Math.sin(t * 9)) * 0.9;
        if (this.x >= ENTER_X) this.depart(t, false);
        break;
      case 'freeze':
        // stone-still, ears up — and then she is simply not there anymore
        if (t >= this.freezeUntil) { this.mode = 'bolt'; this.faceOut(); }
        break;
      case 'bolt':
        this.x += BOLT * dt;
        g.position.x = this.x;
        g.position.y = this.py + Math.abs(Math.sin(t * 22)) * 1.4;
        if (this.x >= ENTER_X) this.depart(t, true);
        break;
    }
  }

  private faceOut() {
    this.trot.visible = true;
    this.sit.visible = false;
    this.trot.scale.x = -1; // flipped: facing right, the way out
    this.trot.rotation.z = 0;
    this.py = this.group.position.y < BASE_Y - 8 ? this.group.position.y : BASE_Y;
    this.group.position.y = this.py;
    this.sit.rotation.z = 0;
    // if she still carries her gift, she keeps it — it was not yet given
  }

  private depart(t: number, startled: boolean) {
    this.mode = 'away';
    this.group.visible = false;
    this.carry.visible = false;
    this.carrying = null;
    // a yard she trusts, she visits more often: 1-3h as a stranger,
    // closer to 40-100 min as a friend
    const w = 1 - 0.45 * this.warmth();
    this.nextVisit = t + (3600 + Math.random() * 7200) * w;
    // a fright counts wherever it happens; calm only counts if she truly sat
    if (startled || this.sat) this.onVisitEnd?.(startled);
  }
}
