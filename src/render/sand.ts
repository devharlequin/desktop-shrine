import * as THREE from 'three';
import { VIRTUAL_W, VIRTUAL_H } from './renderer';
import type { FoxPrint, Garden, RakeStroke, SandTool } from '../core/garden';
import { printStrength, strokeStrength } from '../core/garden';

/** The user's raked-sand patch, foreground right of the steps. Virtual px. */
export const SAND_RECT = { x: 264, y: 224, w: 92, h: 26 };

/** Extra texels per virtual px in the close-up texture — grooves drawn while
 *  zoomed keep their fine detail instead of snapping to the far view's grid. */
const HI = 4;

const toScene = (r: { x: number; y: number; w: number; h: number }) =>
  new THREE.Vector3(r.x + r.w / 2 - VIRTUAL_W / 2, VIRTUAL_H / 2 - (r.y + r.h / 2), 30);

const DARK = 'rgba(24,20,40,';
const LIGHT = 'rgba(130,122,158,';

/** Tine offsets per tool, in virtual px across the stroke. */
const TINES: Record<Exclude<SandTool, 'ring'>, number[]> = {
  rake: [-2, 0, 2],
  wide: [-5, -2.5, 0, 2.5, 5],
  point: [0],
};

export class SandPatch {
  mesh: THREE.Mesh;
  private cv = document.createElement('canvas');   // far view, 1 texel : 1 vpx
  private cvHi = document.createElement('canvas'); // close-up, HI texels : 1 vpx
  private tex: THREE.CanvasTexture;
  private texHi: THREE.CanvasTexture;
  private grain: { x: number; y: number; c: string }[] = [];
  private zoomed = false;

  constructor() {
    this.cv.width = SAND_RECT.w;
    this.cv.height = SAND_RECT.h;
    this.cvHi.width = SAND_RECT.w * HI;
    this.cvHi.height = SAND_RECT.h * HI;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter;
    this.texHi = new THREE.CanvasTexture(this.cvHi);
    this.texHi.magFilter = this.texHi.minFilter = THREE.NearestFilter;
    // a scatter of lighter and darker grains, fixed for the session, so the
    // close-up reads as sand rather than a flat plane
    for (let i = 0; i < 380; i++) {
      this.grain.push({
        x: Math.random() * this.cvHi.width,
        y: Math.random() * this.cvHi.height,
        c: Math.random() < 0.5 ? 'rgba(110,102,138,0.5)' : 'rgba(64,58,84,0.5)',
      });
    }
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SAND_RECT.w, SAND_RECT.h),
      new THREE.MeshLambertMaterial({ map: this.tex, transparent: true }),
    );
    this.mesh.position.copy(toScene(SAND_RECT));
  }

  /** The close-up swaps in the fine texture; stepping back restores the far one. */
  setZoomed(z: boolean) {
    if (z === this.zoomed) return;
    this.zoomed = z;
    const m = this.mesh.material as THREE.MeshLambertMaterial;
    m.map = z ? this.texHi : this.tex;
    m.needsUpdate = true;
  }

  /** live = the stroke currently being drawn (not yet committed to the garden) */
  redraw(g: Garden, now: number, live?: RakeStroke | null) {
    this.paint(this.cv.getContext('2d')!, 1, g, now, live, false);
    this.paint(this.cvHi.getContext('2d')!, HI, g, now, live, true);
    this.tex.needsUpdate = true;
    this.texHi.needsUpdate = true;
  }

  private paint(
    c: CanvasRenderingContext2D, res: number,
    g: Garden, now: number, live: RakeStroke | null | undefined, grain: boolean,
  ) {
    const w = SAND_RECT.w * res, h = SAND_RECT.h * res;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#514a66';
    c.fillRect(0, 0, w, h);
    if (grain) for (const p of this.grain) { c.fillStyle = p.c; c.fillRect(p.x, p.y, 1, 1); }
    // soft darker rim so it reads as a bed of sand, not a rectangle
    c.strokeStyle = DARK + '0.9)';
    c.lineWidth = res;
    c.strokeRect(res / 2, res / 2, w - res, h - res);
    for (const s of g.rakeStrokes) this.drawStroke(c, res, s, strokeStrength(s, now));
    for (const p of g.foxPrints ?? []) this.drawPrint(c, res, p, printStrength(p, now));
    if (live) this.drawStroke(c, res, live, 1);
  }

  /** A fox's paw, pressed into the sand: one pad, three toes above it. */
  private drawPrint(c: CanvasRenderingContext2D, res: number, p: FoxPrint, k: number) {
    if (k <= 0) return;
    const x = (p.x - SAND_RECT.x) * res, y = (p.y - SAND_RECT.y) * res;
    c.fillStyle = `${DARK}${0.75 * k})`;
    c.beginPath();
    c.ellipse(x, y, Math.max(0.5, res * 0.7), Math.max(0.5, res * 0.55), 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = `${DARK}${0.6 * k})`;
    for (const tx of [-0.7, 0, 0.7]) {
      c.beginPath();
      c.arc(x + tx * res, y - res * 0.9, Math.max(0.4, res * 0.22), 0, Math.PI * 2);
      c.fill();
    }
    // the pressed rim of sand, catching light below the pad
    c.fillStyle = `${LIGHT}${0.35 * k})`;
    c.fillRect(x - res * 0.6, y + res * 0.6, res * 1.2, Math.max(0.5, res * 0.3));
  }

  private drawStroke(c: CanvasRenderingContext2D, res: number, s: RakeStroke, k: number) {
    if (k <= 0 || s.points.length < 1) return;
    if (s.tool === 'ring') return this.drawRing(c, res, s, k);
    if (s.points.length < 2) return;
    for (const off of TINES[s.tool ?? 'rake']) {
      c.strokeStyle = off === 0 ? `${DARK}${0.85 * k})` : `${LIGHT}${0.55 * k})`;
      c.lineWidth = off === 0 ? Math.max(1, res * 0.6) : Math.max(1, res * 0.45);
      c.beginPath();
      c.moveTo((s.points[0].x - SAND_RECT.x) * res, (s.points[0].y - SAND_RECT.y + off) * res);
      for (const p of s.points.slice(1)) c.lineTo((p.x - SAND_RECT.x) * res, (p.y - SAND_RECT.y + off) * res);
      c.stroke();
    }
  }

  /** The ring stamp: concentric grooves, as the rakes leave around a stone. */
  private drawRing(c: CanvasRenderingContext2D, res: number, s: RakeStroke, k: number) {
    const x = (s.points[0].x - SAND_RECT.x) * res, y = (s.points[0].y - SAND_RECT.y) * res;
    const rings: [number, string, number][] = [
      [4, DARK, 0.85], [5.1, LIGHT, 0.55], [7, DARK, 0.75], [8.1, LIGHT, 0.5],
    ];
    for (const [r, col, a] of rings) {
      c.strokeStyle = `${col}${a * k})`;
      c.lineWidth = Math.max(1, res * 0.5);
      c.beginPath();
      c.arc(x, y, r * res, 0, Math.PI * 2);
      c.stroke();
    }
  }
}

export class LeafSprites {
  group = new THREE.Group();

  sync(g: Garden) {
    this.group.clear();
    const cols = [0xb8622e, 0x8a6a2e, 0x6a7a3e];
    for (const l of g.leaves) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 3),
        new THREE.MeshLambertMaterial({ color: cols[l.kind], transparent: true }),
      );
      // settled leaves lie UNDER whoever walks past (keeper 26+, cat 20.7+ on the
      // stairs) but above the steps quad (20) — except on the sand bed (30), where
      // they must stay in front of the sand or they'd vanish behind it. No walker
      // crosses the sand bed, so 30.5 never covers anyone.
      const onSand = l.x >= SAND_RECT.x && l.x <= SAND_RECT.x + SAND_RECT.w && l.y >= SAND_RECT.y;
      m.position.set(l.x - VIRTUAL_W / 2, VIRTUAL_H / 2 - l.y, onSand ? 30.5 : 20.4);
      m.rotation.z = ((l.x * 13) % 7) / 7;
      this.group.add(m);
    }
  }
}
