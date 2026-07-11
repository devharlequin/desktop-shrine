import * as THREE from 'three';
import { VIRTUAL_W, VIRTUAL_H } from './renderer';
import type { Garden, RakeStroke } from '../core/garden';
import { strokeStrength } from '../core/garden';

/** The user's raked-sand patch, foreground right of the steps. Virtual px. */
export const SAND_RECT = { x: 264, y: 224, w: 92, h: 26 };

const toScene = (r: { x: number; y: number; w: number; h: number }) =>
  new THREE.Vector3(r.x + r.w / 2 - VIRTUAL_W / 2, VIRTUAL_H / 2 - (r.y + r.h / 2), 30);

export class SandPatch {
  mesh: THREE.Mesh;
  private cv = document.createElement('canvas');
  private tex: THREE.CanvasTexture;

  constructor() {
    this.cv.width = SAND_RECT.w;
    this.cv.height = SAND_RECT.h;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SAND_RECT.w, SAND_RECT.h),
      new THREE.MeshLambertMaterial({ map: this.tex, transparent: true }),
    );
    this.mesh.position.copy(toScene(SAND_RECT));
  }

  /** live = the stroke currently being drawn (not yet committed to the garden) */
  redraw(g: Garden, now: number, live?: RakeStroke | null) {
    const c = this.cv.getContext('2d')!;
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.fillStyle = '#514a66';
    c.fillRect(0, 0, this.cv.width, this.cv.height);
    // soft darker rim so it reads as a bed of sand, not a rectangle
    c.strokeStyle = 'rgba(24,20,40,0.9)';
    c.strokeRect(0.5, 0.5, this.cv.width - 1, this.cv.height - 1);
    for (const s of g.rakeStrokes) this.drawStroke(c, s, strokeStrength(s, now));
    if (live && live.points.length > 1) this.drawStroke(c, live, 1);
    this.tex.needsUpdate = true;
  }

  private drawStroke(c: CanvasRenderingContext2D, s: RakeStroke, k: number) {
    if (k <= 0 || s.points.length < 2) return;
    for (const off of [-2, 0, 2]) { // three tines
      c.strokeStyle = off === 0 ? `rgba(24,20,40,${0.85 * k})` : `rgba(130,122,158,${0.55 * k})`;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(s.points[0].x - SAND_RECT.x, s.points[0].y - SAND_RECT.y + off);
      for (const p of s.points.slice(1)) c.lineTo(p.x - SAND_RECT.x, p.y - SAND_RECT.y + off);
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
      m.position.set(l.x - VIRTUAL_W / 2, VIRTUAL_H / 2 - l.y, 31);
      m.rotation.z = ((l.x * 13) % 7) / 7;
      this.group.add(m);
    }
  }
}
