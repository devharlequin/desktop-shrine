import * as THREE from 'three';
import { PixelRenderer, VIRTUAL_W, VIRTUAL_H } from './render/renderer';
import { buildShrineScene, loadTex } from './render/scene';
import { Sky } from './render/sky';
import { Lights } from './render/lights';
import { Incense } from './render/incense';
import { Moths } from './render/moths';
import { ClaudingView } from './render/claudingView';
import { SandPatch, LeafSprites, SAND_RECT } from './render/sand';
import { CeremonyDirector } from './render/ceremony';
import { ClaudingBrain } from './core/clauding';
import { timeOfDay, season } from './core/clock';
import { OfferingCeremony } from './core/offering';
import { classifyGesture } from './core/pointerTools';
import {
  activeResponses, addRakeStroke, recordOffering, spawnLeaf, sweepLeavesNear,
  tickWeathering, type Garden, type RakeStroke, type ResponseId,
} from './core/garden';
import { makeBridge } from './bridge';

// --- dev-only clock override: keys 1..4 = dawn/day/dusk/night, 0 = real time ---
let DEV_HOUR: number | null = null;
if (import.meta.env.DEV) {
  addEventListener('keydown', e => {
    const map: Record<string, number | null> = { '1': 6, '2': 12, '3': 18.5, '4': 23, '0': null };
    if (e.key in map) DEV_HOUR = map[e.key];
  });
}
const now = () =>
  DEV_HOUR == null
    ? new Date()
    : new Date(2026, 6, 10, Math.floor(DEV_HOUR), (DEV_HOUR % 1) * 60);

async function boot() {
  const canvas = document.createElement('canvas');
  document.querySelector('#app')!.appendChild(canvas);

  const px = new PixelRenderer(canvas);
  const bridge = await makeBridge();
  const { scene, camera, layers } = await buildShrineScene();

  // --- persistent garden ---
  let garden: Garden = tickWeathering(await bridge.loadGarden(), Date.now());
  const save = () => bridge.saveGarden(garden);

  // --- sky behind everything ---
  const sky = new Sky(loadTex('moon'));
  sky.addTo(scene);
  layers.get('moon')?.removeFromParent(); // Sky owns the moon

  // --- lights anchored to the sliced candle/altar positions ---
  const candleL = layers.get('candle_l')!.position.clone().add(new THREE.Vector3(0, 8, 2));
  const candleR = layers.get('candle_r')!.position.clone().add(new THREE.Vector3(0, 8, 2));
  const altar = layers.get('altar')!.position.clone().add(new THREE.Vector3(0, 6, 2));
  const lights = new Lights(candleL, candleR, altar);
  lights.addTo(scene);

  const incense = new Incense(altar.clone().add(new THREE.Vector3(6, 4, 0)));
  scene.add(incense.group);

  const brain = new ClaudingBrain();
  const view = new ClaudingView();
  scene.add(view.mesh);

  const moths = new Moths([candleL, candleR]);
  scene.add(moths.group);

  // --- the tended ground ---
  const sand = new SandPatch();
  const leaves = new LeafSprites();
  scene.add(sand.mesh, leaves.group);
  sand.redraw(garden, Date.now());
  leaves.sync(garden);

  // --- one resident firefly, when the shrine grants one ---
  const firefly = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ color: 0xd8e078, transparent: true }),
  );
  firefly.visible = false;
  scene.add(firefly);

  // --- the offering ceremony ---
  const director = new CeremonyDirector(view, brain, scene);
  const ceremony = new OfferingCeremony(
    async m => {
      const r = await bridge.takeOffering(m);
      if (r.ok) {
        garden = recordOffering(garden, Date.now(), r.responses as ResponseId[]);
        await save();
      }
      return r;
    },
    s => director.onState(s),
  );
  director.bind(ceremony);

  let quieted = false;

  if (bridge.kind === 'tauri') {
    // real file paths + window dragging + pending queue live in the tauri world
    const { getCurrentWebview } = await import('@tauri-apps/api/webview');
    await getCurrentWebview().onDragDropEvent(ev => {
      if (quieted) return;
      if (ev.payload.type === 'over') ceremony.dragOver();
      if (ev.payload.type === 'leave') ceremony.dragLeave();
      if (ev.payload.type === 'drop' && ev.payload.paths[0]) {
        const p = ev.payload.paths[0];
        ceremony.drop({ name: p.split(/[\\/]/).pop()!, path: p });
      }
    });
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const { listen } = await import('@tauri-apps/api/event');
    await listen('shrine://quiet', () => { quieted = !quieted; });
    canvas.addEventListener('pointerdown', e => {
      const vy = (e.clientY - canvas.getBoundingClientRect().top) / px.scale;
      if (vy < 140) getCurrentWindow().startDragging(); // grab the sky to move the window
    });
    const pending = await (bridge as any).processPending?.() as string[] | undefined;
    if (pending?.length) {
      garden = recordOffering(garden, Date.now(), pending as ResponseId[]);
      await save();
    }
  } else {
    // browser: HTML5 drag and drop, no real paths
    addEventListener('dragover', e => { e.preventDefault(); if (!quieted) ceremony.dragOver(); });
    addEventListener('dragleave', () => ceremony.dragLeave());
    addEventListener('drop', e => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f && !quieted) ceremony.drop({ name: f.name, path: '' });
    });
  }

  // --- rake & sweep ---
  const toVirtual = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / px.scale, y: (e.clientY - r.top) / px.scale };
  };
  let liveStroke: RakeStroke | null = null;
  canvas.addEventListener('pointerdown', e => {
    const p = toVirtual(e);
    const g = classifyGesture(p, SAND_RECT, garden.leaves);
    if (g === 'rake') liveStroke = { points: [p], t: Date.now() };
    if (g === 'sweep') {
      garden = sweepLeavesNear(garden, p, 10);
      leaves.sync(garden);
    }
  });
  canvas.addEventListener('pointermove', e => {
    const p = toVirtual(e);
    if (liveStroke) {
      const lastP = liveStroke.points[liveStroke.points.length - 1];
      if (Math.hypot(p.x - lastP.x, p.y - lastP.y) >= 2) {
        // clamp to the sand bed
        p.x = Math.min(Math.max(p.x, SAND_RECT.x + 1), SAND_RECT.x + SAND_RECT.w - 1);
        p.y = Math.min(Math.max(p.y, SAND_RECT.y + 2), SAND_RECT.y + SAND_RECT.h - 2);
        liveStroke.points.push(p);
        sand.redraw(garden, Date.now(), liveStroke);
      }
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.buttons) {
      const g = classifyGesture(p, SAND_RECT, garden.leaves);
      if (g === 'sweep') {
        garden = sweepLeavesNear(garden, p, 10);
        leaves.sync(garden);
      }
    }
    canvas.style.cursor =
      classifyGesture(p, SAND_RECT, garden.leaves) === 'none' ? 'default' : 'grab';
  });
  const endStroke = () => {
    if (liveStroke && liveStroke.points.length > 1) {
      garden = addRakeStroke(garden, liveStroke);
      void save();
    }
    liveStroke = null;
    sand.redraw(garden, Date.now());
  };
  canvas.addEventListener('pointerup', () => { endStroke(); void save(); });
  canvas.addEventListener('pointerleave', endStroke);

  // --- leaves drift in over the hours ---
  const spawnSeasonalLeaves = () => {
    const s = season(now());
    if (s === 'winter' || garden.leaves.length > 40) return;
    const n = Math.floor(Math.random() * (s === 'autumn' ? 5 : 3)); // 0-4 autumn, 0-2 else
    for (let i = 0; i < n; i++) {
      garden = spawnLeaf(garden, {
        x: 30 + Math.random() * (VIRTUAL_W - 60),
        y: 195 + Math.random() * 55,
      }, Date.now());
    }
    if (n) { leaves.sync(garden); void save(); }
  };
  spawnSeasonalLeaves();
  setInterval(spawnSeasonalLeaves, 3600_000);

  if (import.meta.env.DEV) {
    Object.assign(window as any, { __scene: scene, __layers: layers, __camera: camera, __px: px, __ceremony: ceremony, __garden: () => garden });
  }

  // --- the loop ---
  let last = performance.now();
  function loop() {
    const nowMs = performance.now();
    const dt = Math.min(0.1, (nowMs - last) / 1000);
    last = nowMs;
    const t = nowMs / 1000;
    const d = now();

    const state = brain.tick(d);
    view.ambient(state.activity, t);
    view.update(dt, t);

    const act = activeResponses(garden, Date.now());
    lights.candlesLit = brain.candlesLit || timeOfDay(d) === 'night';
    lights.candlesBoost = act.includes('candles-brighter') ? 0.9 : 0;
    lights.dim = director.dim;
    lights.update(d, t);

    incense.density = act.includes('incense-thick') ? 2.2 : 1;
    incense.update(dt, t);

    const god = layers.get('god');
    if (god) {
      const m = god.material as THREE.MeshLambertMaterial;
      m.emissive.setHex(0xe8a33d);
      m.emissiveIntensity = act.includes('god-eyes-glow') ? 0.22 + 0.12 * Math.sin(t * 3) : 0;
    }

    firefly.visible = act.includes('firefly') && timeOfDay(d) !== 'day';
    if (firefly.visible) {
      firefly.position.set(
        -80 + Math.sin(t * 0.4) * 60 + Math.sin(t * 1.3) * 12,
        -95 + Math.cos(t * 0.55) * 14,
        29,
      );
      (firefly.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.45 * Math.sin(t * 2.2);
    }

    sky.update(d, t);
    moths.update(t, timeOfDay(d) === 'night' && lights.candlesLit);

    px.frame(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();
}

boot();
