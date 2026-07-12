import * as THREE from 'three';
import { VIRTUAL_W, VIRTUAL_H } from './renderer';
import type { SandTool } from '../core/garden';

/** Everything you can hold over the sand: the stroke tools plus the smoother. */
export type ToolId = SandTool | 'smooth';

// w wood, d slate, l light slate, o warm ember — bright enough for a dark yard
const PAL: Record<string, string> = {
  w: '#a4794f', d: '#6a628e', l: '#b0a8d0', o: '#e8b060',
};

// 13×13 pixel icons, drawn as they'd lie beside a real zen garden
const ICONS: Record<ToolId, string[]> = {
  rake: [
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '.............',
    '...ddddddd...',
    '...d..d..d...',
    '...d..d..d...',
    '.............',
    '.............',
  ],
  wide: [
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '.............',
    'ddddddddddddd',
    'd..d..d..d..d',
    'd..d..d..d..d',
    '.............',
    '.............',
  ],
  point: [
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '......dd.....',
    '......dd.....',
    '......d......',
    '.............',
  ],
  ring: [
    '.............',
    '....ddddd....',
    '...d.....d...',
    '..d.......d..',
    '..d.......d..',
    '..d...o...d..',
    '..d.......d..',
    '..d.......d..',
    '...d.....d...',
    '....ddddd....',
    '.............',
    '.............',
    '.............',
  ],
  smooth: [
    '.............',
    '.............',
    '......ww.....',
    '......ww.....',
    '......ww.....',
    '.....wwww....',
    '.............',
    '.ddddddddddd.',
    '.ddddddddddd.',
    '.lllllllllll.',
    '.............',
    '.............',
    '.............',
  ],
};

const ICON = 13;
const ROW_Y = 207; // on the ground, above the sand bed (sand top = 224)
const SPOTS: { id: ToolId; x: number }[] = [
  { id: 'rake', x: 270 }, { id: 'wide', x: 290 }, { id: 'point', x: 310 },
  { id: 'ring', x: 330 }, { id: 'smooth', x: 350 },
];

function iconTex(rows: string[]): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = ICON;
  const c = cv.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const p = PAL[row[x]];
      if (p) { c.fillStyle = p; c.fillRect(x, y, 1, 1); }
    }
  });
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  return t;
}

/** The little tool rack that appears beside the sand in the close-up.
 *  MeshBasicMaterial throughout — tools stay readable on a moonless night. */
export class SandTools {
  group = new THREE.Group();
  current: ToolId = 'rake';
  private icons = new Map<ToolId, THREE.Mesh>();
  private glow: THREE.Mesh;
  private shown = 0;

  constructor() {
    // additive so it reads as candlelight on the chosen tool, not a painted box
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xe8b060, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(ICON + 4, ICON + 4), glowMat);
    this.glow.position.z = 31.8;
    this.group.add(this.glow);
    for (const s of SPOTS) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(ICON, ICON),
        new THREE.MeshBasicMaterial({ map: iconTex(ICONS[s.id]), transparent: true, opacity: 0 }),
      );
      m.position.set(s.x - VIRTUAL_W / 2, VIRTUAL_H / 2 - ROW_Y, 32);
      this.icons.set(s.id, m);
      this.group.add(m);
    }
    this.group.visible = false;
    this.select('rake');
  }

  /** k 0..1 — the rack fades in with the camera's approach. */
  fade(k: number) {
    this.shown = k;
    this.group.visible = k > 0.02;
    for (const m of this.icons.values()) (m.material as THREE.MeshBasicMaterial).opacity = k;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.2 * k;
  }

  /** Which tool sits under the pointer, if the rack is out. */
  hit(p: { x: number; y: number }): ToolId | null {
    if (this.shown < 0.9) return null;
    const s = SPOTS.find(s =>
      Math.abs(p.x - s.x) <= ICON / 2 + 2 && Math.abs(p.y - ROW_Y) <= ICON / 2 + 2);
    return s?.id ?? null;
  }

  select(id: ToolId) {
    this.current = id;
    const spot = SPOTS.find(s => s.id === id)!;
    this.glow.position.x = spot.x - VIRTUAL_W / 2;
    this.glow.position.y = VIRTUAL_H / 2 - ROW_Y;
    // the chosen tool sits up a little, as if picked from the row
    for (const [tid, m] of this.icons) {
      m.position.y = VIRTUAL_H / 2 - ROW_Y + (tid === id ? 1.5 : 0);
    }
  }
}
