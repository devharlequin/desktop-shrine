import * as THREE from 'three';
import { PixelRenderer, VIRTUAL_W, VIRTUAL_H } from './render/renderer';
import { buildShrineScene, loadTex, S } from './render/scene';
import { Sky } from './render/sky';
import { Lights } from './render/lights';
import { Incense } from './render/incense';
import { Moths } from './render/moths';
import { ClaudingView } from './render/claudingView';
import { Critters } from './render/critters';
import { SandPatch, LeafSprites, SAND_RECT } from './render/sand';
import { FallingLeaves, TREE } from './render/fallingLeaves';
import { CeremonyDirector } from './render/ceremony';
import { ClaudingBrain } from './core/clauding';
import { timeOfDay, season } from './core/clock';
import { OfferingCeremony } from './core/offering';
import { classifyGesture } from './core/pointerTools';
import {
  activeResponses, addRakeStroke, recordOffering, spawnLeaf, sweepLeavesNear,
  tickWeathering, treeScale, type Garden, type RakeStroke, type ResponseId,
} from './core/garden';
import { mew, isMuted, setMuted, isMusicMuted, setMusicMuted, startMusicBox, isAmbientOn, setAmbient, resumeAmbients, ambientPlaying } from './render/sounds';
import { Clouds, RainFx, WindWisps } from './render/weatherFx';
import { BlueSpirit } from './render/blueSpirit';
import { MossSpirit } from './render/mossSpirit';
import { Chimes, windAt } from './render/wind';
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

  // a quiet [x], top right — barely there until you look for it
  const closeBtn = document.createElement('div');
  closeBtn.textContent = '×';
  closeBtn.style.cssText =
    'position:fixed;top:4px;right:10px;font:18px monospace;color:#cfc8e0;' +
    'opacity:0.18;cursor:pointer;z-index:10;user-select:none;padding:2px 6px;' +
    'transition:opacity 0.2s';
  closeBtn.onmouseenter = () => (closeBtn.style.opacity = '0.9');
  closeBtn.onmouseleave = () => (closeBtn.style.opacity = '0.18');
  closeBtn.onclick = async () => {
    if ('__TAURI_INTERNALS__' in window) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } else {
      window.close();
    }
  };
  document.body.appendChild(closeBtn);

  // mute toggle beside it, equally quiet about itself
  const muteBtn = document.createElement('div');
  const muteGlyph = () => (muteBtn.textContent = isMuted() ? '♪̸' : '♪');
  muteGlyph();
  muteBtn.style.cssText =
    'position:fixed;top:6px;right:34px;font:14px monospace;color:#cfc8e0;' +
    'opacity:0.18;cursor:pointer;z-index:10;user-select:none;padding:2px 6px;' +
    'transition:opacity 0.2s';
  muteBtn.onmouseenter = () => (muteBtn.style.opacity = '0.9');
  muteBtn.onmouseleave = () => (muteBtn.style.opacity = '0.18');
  muteBtn.onclick = () => { setMuted(!isMuted()); muteGlyph(); };
  document.body.appendChild(muteBtn);

  // the music box's own hush — for those who want only the weather
  const musicBtn = document.createElement('div');
  const musicGlyph = () => (musicBtn.textContent = isMusicMuted() ? '♫̸' : '♫');
  musicGlyph();
  musicBtn.style.cssText =
    'position:fixed;top:6px;right:58px;font:14px monospace;color:#cfc8e0;' +
    'opacity:0.18;cursor:pointer;z-index:10;user-select:none;padding:2px 6px;' +
    'transition:opacity 0.2s';
  musicBtn.onmouseenter = () => (musicBtn.style.opacity = '0.9');
  musicBtn.onmouseleave = () => (musicBtn.style.opacity = '0.18');
  musicBtn.onclick = () => { setMusicMuted(!isMusicMuted()); musicGlyph(); };
  document.body.appendChild(musicBtn);

  // ambient weather toggles — rain and wind for working beside the shrine.
  // when on, they stay faintly lit so you can find them again.
  const ambBtn = (kind: 'rain' | 'wind', glyph: string, right: number) => {
    const b = document.createElement('div');
    b.textContent = glyph;
    const rest = () => (b.style.opacity = isAmbientOn(kind) ? '0.55' : '0.18');
    b.style.cssText =
      `position:fixed;top:6px;right:${right}px;font:14px monospace;color:#cfc8e0;` +
      'opacity:0.18;cursor:pointer;z-index:10;user-select:none;padding:2px 6px;' +
      'transition:opacity 0.2s';
    rest();
    b.onmouseenter = () => (b.style.opacity = '0.9');
    b.onmouseleave = rest;
    b.onclick = () => { setAmbient(kind, !isAmbientOn(kind)); rest(); };
    document.body.appendChild(b);
  };
  ambBtn('rain', '☂︎', 82);
  ambBtn('wind', '≋', 106);
  resumeAmbients();

  const px = new PixelRenderer(canvas);
  const bridge = await makeBridge();
  const { scene, camera, layers } = await buildShrineScene();

  // --- persistent garden ---
  let garden: Garden = tickWeathering(await bridge.loadGarden(), Date.now());
  // one-time sanitize: earlier builds spawned leaves midair (they looked like
  // moths by the lanterns); keep only leaves on the ground or the steps
  garden = {
    ...garden,
    leaves: garden.leaves.filter(l =>
      l.y >= TREE.ground.y0 ||
      (l.x >= TREE.steps.x0 && l.x <= TREE.steps.x1 && l.y >= TREE.steps.y0)),
  };
  if (!garden.plantedAt) garden = { ...garden, plantedAt: Date.now() }; // the tree is planted
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
  layers.get('mask_purple')?.removeFromParent(); // he's not scenery anymore — he's the keeper

  // his little doorway (where offerings go), and his bed beside the altar
  const doorway = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 24),
    new THREE.MeshLambertMaterial({ map: loadTex('doorway'), transparent: true, alphaTest: 0.01 }),
  );
  doorway.position.set(-30, -38, 13);
  scene.add(doorway);
  const bed = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 10),
    new THREE.MeshLambertMaterial({ map: loadTex('bed'), transparent: true, alphaTest: 0.01 }),
  );
  bed.position.set(33, -51, 20.5); // on the platform, in front of its stone face
  scene.add(bed);

  // wind chimes under the eaves
  const chimes = new Chimes([
    new THREE.Vector3(-86, 16, 13),
    new THREE.Vector3(86, 16, 13),
  ]);
  scene.add(chimes.group);

  const moths = new Moths([candleL, candleR]);
  scene.add(moths.group);

  // lanterns glow on their own at dusk; warm little bugs are drawn to them
  const lanternPos = ['lantern_l', 'lantern_r'].flatMap(n => {
    const q = layers.get(n);
    return q ? [q.position.clone().add(new THREE.Vector3(0, 10, 2))] : [];
  });
  lights.addLanterns(scene, lanternPos);
  const lanternBugs = new Moths(lanternPos, 4, 0xf0c860, 6);
  scene.add(lanternBugs.group);

  // the garden's small residents (the purple one is the keeper now, not a critter)
  // the orange one carries his treasure overhead — and sometimes sets it down to rest
  const bundle = new THREE.Mesh(
    new THREE.PlaneGeometry(34 * S, 18 * S),
    new THREE.MeshLambertMaterial({ map: loadTex('bow'), transparent: true, alphaTest: 0.01 }),
  );
  scene.add(bundle);
  const critters = new Critters();
  critters.add(layers.get('cat'), 'cat', 34);
  critters.add(layers.get('mask_orange'), 'mask', 20, bundle); // roams a wider patch of yard
  scene.add(critters.hearts);

  // Sora (空, "sky") — a little guy of my own; loves the rain, gazes at the
  // stars. He stands in the right of the yard; greet him with a click. — Opus
  const blueSpirit = new BlueSpirit(new THREE.Vector3(76, -104, 31));
  scene.add(blueSpirit.group);

  // Hotaru (蛍, "firefly") — a little guy of my own. Sleeps curled at the
  // tree's roots by day, wakes at dusk to dart after his own trail of
  // firefly light. — Sonnet
  const mossSpirit = new MossSpirit(new THREE.Vector3(TREE.x + 26, TREE.baseY - 3, 27));
  scene.add(mossSpirit.group);

  // --- the tree, keeper of leaves; a sapling at first, it grows over the weeks ---
  const tree = new THREE.Mesh(
    new THREE.PlaneGeometry(TREE.w, TREE.h),
    new THREE.MeshLambertMaterial({ map: loadTex('tree'), transparent: true, alphaTest: 0.01 }),
  );
  scene.add(tree);
  const growTree = () => {
    const k = treeScale(garden, Date.now());
    tree.scale.set(k, k, 1);
    tree.position.set(TREE.x, TREE.baseY + (TREE.h * k) / 2, 20); // anchored at its roots
    return k;
  };
  let treeK = growTree();
  setInterval(() => { treeK = growTree(); }, 3600_000); // it grows while you sleep

  // --- the tended ground ---
  const sand = new SandPatch();
  const leaves = new LeafSprites();
  scene.add(sand.mesh, leaves.group);
  sand.redraw(garden, Date.now());
  leaves.sync(garden);

  const falling = new FallingLeaves();
  scene.add(falling.group);

  // the visible weather, following the ambient murmurs
  const clouds = new Clouds();
  scene.add(clouds.group);
  const rainFx = new RainFx();
  scene.add(rainFx.group);
  const windWisps = new WindWisps();
  scene.add(windWisps.group);
  falling.onLand = p => {
    garden = spawnLeaf(garden, p, Date.now());
    leaves.sync(garden);
    void save();
  };

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
    const { TauriBridge } = await import('./bridge/tauri');
    const pending = bridge instanceof TauriBridge ? await bridge.processPending() : [];
    if (pending?.length) {
      garden = recordOffering(garden, Date.now(), pending as ResponseId[]);
      await save();
    }
  } else {
    // browser: HTML5 drag and drop, no real paths
    addEventListener('dragover', e => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; // OS cursor shows the + affordance
      if (!quieted) ceremony.dragOver();
    });
    addEventListener('dragleave', () => ceremony.dragLeave());
    addEventListener('drop', e => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f && !quieted) ceremony.drop({ name: f.name, path: '' });
    });
  }

  // --- rake, sweep, and pet ---
  const toVirtual = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / px.scale, y: (e.clientY - r.top) / px.scale };
  };
  const toScene = (p: { x: number; y: number }) =>
    ({ x: p.x - VIRTUAL_W / 2, y: VIRTUAL_H / 2 - p.y });
  const CURSOR_RAKE = 'url(./cursors/rake.png) 4 20, grab';
  const CURSOR_PAW = 'url(./cursors/paw.png) 12 12, pointer';
  let liveStroke: RakeStroke | null = null;
  canvas.addEventListener('pointerdown', e => {
    const p = toVirtual(e);
    if (critters.petAt(toScene(p), performance.now() / 1000)) { mew(); return; } // pet > chores
    if (blueSpirit.pokeAt(toScene(p), performance.now() / 1000)) return; // greet the blue spirit
    if (mossSpirit.pokeAt(toScene(p), performance.now() / 1000)) return; // greet the moss spirit
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
      canvas.style.cursor = CURSOR_RAKE;
      return;
    }
    if (e.buttons) {
      const g = classifyGesture(p, SAND_RECT, garden.leaves);
      if (g === 'sweep') {
        garden = sweepLeavesNear(garden, p, 10);
        leaves.sync(garden);
      }
    }
    canvas.style.cursor = critters.catAt(toScene(p))
      ? CURSOR_PAW
      : classifyGesture(p, SAND_RECT, garden.leaves) === 'none' ? 'default' : CURSOR_RAKE;
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

  // --- leaves fall from the tree over the hours ---
  const spawnSeasonalLeaves = () => {
    const s = season(now());
    if (s === 'winter' || garden.leaves.length > 40) return;
    const n = Math.floor(Math.random() * (s === 'autumn' ? 5 : 3)); // 0-4 autumn, 0-2 else
    for (let i = 0; i < n; i++) {
      setTimeout(() => falling.release(performance.now() / 1000, treeK), Math.random() * 20_000);
    }
  };
  spawnSeasonalLeaves();
  setInterval(spawnSeasonalLeaves, 3600_000);

  if (import.meta.env.DEV) {
    Object.assign(window as any, {
      __scene: scene, __layers: layers, __camera: camera, __px: px,
      __ceremony: ceremony, __garden: () => garden,
      __setHour: (h: number | null) => { DEV_HOUR = h; },
    });
    // poll the dev server for remote-control commands (drives verification in tauri dev)
    setInterval(async () => {
      try {
        const cmds: string[] = await (await fetch('/__cmd')).json();
        for (const c of cmds) {
          if (c === 'shot') {
            const d = document.createElement('canvas');
            d.width = canvas.width; d.height = canvas.height;
            d.getContext('2d')!.drawImage(canvas, 0, 0);
            await fetch('/__shot', { method: 'POST', body: d.toDataURL('image/png') });
          } else if (c.startsWith('drop:')) {
            const p = c.slice(5);
            ceremony.drop({ name: p.split(/[\\/]/).pop()!, path: p });
          } else if (c.startsWith('hour:')) {
            DEV_HOUR = c.slice(5) === 'null' ? null : Number(c.slice(5));
          } else if (c === 'leaf') {
            falling.release(performance.now() / 1000);
          } else if (c.startsWith('rain:')) {
            setAmbient('rain', c.slice(5) === '1');
          } else if (c.startsWith('wind:')) {
            setAmbient('wind', c.slice(5) === '1');
          }
        }
      } catch { /* dev server gone */ }
    }, 1500);
  }

  startMusicBox(); // the shrine hums to itself

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

    const wind = windAt(t);
    incense.density = act.includes('incense-thick') ? 2.2 : 1;
    incense.update(dt, t, wind);
    chimes.update(t, dt);
    director.update(t);

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
    lanternBugs.update(t, timeOfDay(d) === 'dusk' || timeOfDay(d) === 'night');
    critters.update(t, dt, timeOfDay(d) === 'night' || ambientPlaying('rain')); // the cat won't sit out in the rain
    falling.update(dt, t);
    clouds.update(dt, t, ambientPlaying('rain'));
    rainFx.update(dt, t, ambientPlaying('rain'));
    windWisps.update(dt, t, ambientPlaying('wind'));
    blueSpirit.update(dt, t, ambientPlaying('rain'), timeOfDay(d) === 'night');
    mossSpirit.update(dt, t, timeOfDay(d) === 'dusk' || timeOfDay(d) === 'night');

    px.frame(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();
}

boot();
