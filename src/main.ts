import * as THREE from 'three';
import { PixelRenderer } from './render/renderer';
import { buildShrineScene, loadTex } from './render/scene';
import { Sky } from './render/sky';
import { Lights } from './render/lights';
import { Incense } from './render/incense';
import { Moths } from './render/moths';
import { ClaudingView } from './render/claudingView';
import { ClaudingBrain } from './core/clauding';
import { timeOfDay } from './core/clock';

// --- dev-only clock override: keys 1..4 = dawn/day/dusk/night, 0 = real time ---
let DEV_HOUR: number | null = null;
if (import.meta.env.DEV) {
  addEventListener('keydown', e => {
    const map: Record<string, number | null> = { '1': 6, '2': 12, '3': 18.5, '4': 23, '0': null };
    if (e.key in map) DEV_HOUR = map[e.key];
  });
}
export const now = () =>
  DEV_HOUR == null
    ? new Date()
    : new Date(2026, 6, 10, Math.floor(DEV_HOUR), (DEV_HOUR % 1) * 60);

async function boot() {
  const canvas = document.createElement('canvas');
  document.querySelector('#app')!.appendChild(canvas);

  const px = new PixelRenderer(canvas);
  const { scene, camera, layers } = await buildShrineScene();

  // sky behind everything
  const sky = new Sky(loadTex('moon'));
  sky.addTo(scene);
  layers.get('moon')?.removeFromParent(); // Sky owns the moon; drop the static slice

  // lights anchored to the sliced candle/altar positions (flame near sprite top)
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

  if (import.meta.env.DEV) Object.assign(window as any, { __scene: scene, __layers: layers, __camera: camera, __px: px });

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
    lights.candlesLit = brain.candlesLit || timeOfDay(d) === 'night'; // lit through the night
    lights.update(d, t);
    sky.update(d, t);
    incense.update(dt, t);
    moths.update(t, timeOfDay(d) === 'night' && lights.candlesLit);

    px.frame(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();
}

boot();
