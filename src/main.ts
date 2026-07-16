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
import { SandTools, type ToolId } from './render/sandTools';
import { FallingLeaves, TREE } from './render/fallingLeaves';
import { CeremonyDirector } from './render/ceremony';
import { ClaudingBrain } from './core/clauding';
import { timeOfDay, season } from './core/clock';
import { OfferingCeremony } from './core/offering';
import { classifyGesture } from './core/pointerTools';
import {
  activeResponses, addFoxGift, addRakeStroke, eraseStrokesNear, foxAte,
  foxCalmVisit, foxStartled, foxTrust, GIFTS_SHOWN, recordOffering,
  setOutFood, spawnLeaf,
  sweepLeavesNear, tickWeathering, treeMature, treeScale,
  type Garden, type RakeStroke, type ResponseId,
} from './core/garden';
import { mew, isMuted, setMuted, isMusicMuted, setMusicMuted, startMusicBox, isAmbientOn, setAmbient, resumeAmbients, ambientPlaying, startScrape, scrapeMove, endScrape, sandPress } from './render/sounds';
import { Clouds, RainFx, WindWisps } from './render/weatherFx';
import { BlueSpirit } from './render/blueSpirit';
import { MossSpirit } from './render/mossSpirit';
import { Fox, DISH_X } from './render/fox';
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

  const isTauri = '__TAURI_INTERNALS__' in window;

  // minimize beside the ×, Windows-fashion — the shrine waits on the taskbar
  if (isTauri) {
    const minBtn = document.createElement('div');
    minBtn.textContent = '−';
    minBtn.style.cssText =
      'position:fixed;top:4px;right:34px;font:18px monospace;color:#cfc8e0;' +
      'opacity:0.18;cursor:pointer;z-index:10;user-select:none;padding:2px 6px;' +
      'transition:opacity 0.2s';
    minBtn.onmouseenter = () => (minBtn.style.opacity = '0.9');
    minBtn.onmouseleave = () => (minBtn.style.opacity = '0.18');
    minBtn.onclick = async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    };
    document.body.appendChild(minBtn);
  }

  // mute toggle beside them, equally quiet about itself
  const muteBtn = document.createElement('div');
  const muteGlyph = () => (muteBtn.textContent = isMuted() ? '♪̸' : '♪');
  muteGlyph();
  muteBtn.style.cssText =
    'position:fixed;top:6px;right:58px;font:14px monospace;color:#cfc8e0;' +
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
    'position:fixed;top:6px;right:82px;font:14px monospace;color:#cfc8e0;' +
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
  ambBtn('rain', '☂︎', 106);
  ambBtn('wind', '≋', 130);
  resumeAmbients();

  // the update glyph: dormant when the shrine is current, warmly lit when a
  // newer shrine exists. Clicking it downloads, verifies, and installs the new
  // shrine, then the shrine returns renewed. Never speaks; only glows and turns.
  if (isTauri) {
    const updBtn = document.createElement('div');
    updBtn.textContent = '⟳';
    let found = false;
    let busy = false;
    const rest = () => {
      if (busy) return;
      updBtn.style.opacity = found ? '0.7' : '0.18';
      updBtn.style.color = found ? '#e8b060' : '#cfc8e0';
    };
    updBtn.style.cssText =
      'position:fixed;top:6px;right:154px;font:14px monospace;color:#cfc8e0;' +
      'opacity:0.18;cursor:pointer;z-index:10;user-select:none;padding:2px 6px;' +
      'transition:opacity 0.4s,color 0.4s';
    const lookForUpdate = async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        return await check();
      } catch { return null; } // offline: the shrine doesn't mind
    };
    updBtn.onmouseenter = () => { if (!busy) updBtn.style.opacity = '0.9'; };
    updBtn.onmouseleave = rest;
    updBtn.onclick = async () => {
      if (busy) return;
      const update = await lookForUpdate();
      if (!update) {
        found = false;
        updBtn.style.opacity = '0.05'; // a soft dip: "you already have the newest shrine"
        setTimeout(rest, 450);
        return;
      }
      // the glyph slowly turns while the new shrine is carried in
      busy = true;
      updBtn.style.color = '#e8b060';
      updBtn.style.opacity = '0.9';
      let a = 0;
      const spin = setInterval(() => { a += 30; updBtn.style.transform = `rotate(${a}deg)`; }, 250);
      try {
        await update.downloadAndInstall(); // signature-verified; installer takes it from here
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } catch {
        // could not carry it in — at least show the way (browser fallback)
        clearInterval(spin);
        updBtn.style.transform = '';
        busy = false;
        found = true;
        rest();
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_releases_page').catch(() => {});
      }
    };
    document.body.appendChild(updBtn);
    void lookForUpdate().then(u => { found = !!u; rest(); }); // quiet look at boot
  }

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
  // roams a wider patch of yard, but never into the sand bed (its quad draws in
  // front of him at z=30 and swallows him whole; also: garden manners).
  // 35 keeps him + his set-down bundle left of the bed's edge at scene x=54.
  critters.add(layers.get('mask_orange'), 'mask', 20, bundle, 35);
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

  // Momiji (紅葉, "autumn leaves") — the fox, a wild visitor of my own; she
  // keeps her own calendar, pays her respects, and will not be touched —
  // at first. She remembers this yard between launches now, and a keeper
  // patient across enough calm visits may, once in a while, be suffered
  // to touch her. Startle her and she remembers that longer. — Fable
  const fox = new Fox();
  fox.trust = foxTrust(garden);
  fox.onVisitEnd = startled => {
    garden = startled ? foxStartled(garden) : foxCalmVisit(garden);
    fox.trust = foxTrust(garden);
    save();
  };
  scene.add(fox.group);

  // her dish at the garden rim, on her way in. Click it to set out a morsel;
  // a fed fox decides about you faster — and one day she pays it back.
  const DISH = { x: DISH_X, y: -93, z: 30.6 };
  const flat = (tex: string, w: number, h: number, z = 0) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshLambertMaterial({ map: loadTex(tex), transparent: true, alphaTest: 0.01 }),
    );
    m.position.z = z;
    return m;
  };
  const dishGroup = new THREE.Group();
  dishGroup.position.set(DISH.x, DISH.y, DISH.z);
  const dish = flat('fox_dish', 9, 4);
  const morsel = flat('fox_food', 6, 3, 0.1);
  morsel.position.y = 1;
  dishGroup.add(dish, morsel);
  scene.add(dishGroup);

  // the trove: everything she has ever left, scattered by the dish
  const giftMeshes = new THREE.Group();
  giftMeshes.position.set(DISH.x, DISH.y, DISH.z + 0.2);
  scene.add(giftMeshes);
  const GIFT_SPOTS = [[-9, -3], [8, -2], [-15, 1], [14, 2], [-5, 4],
    [11, -5], [-12, -6], [5, 5], [-18, -2], [17, -4]];
  const GIFT_SIZE: Record<string, [number, number]> = {
    button: [5, 5], coin: [5, 5], cap: [5, 4], card: [5, 7],
  };
  const syncFoxYard = () => {
    morsel.visible = !!garden.foxFoodAt;
    giftMeshes.clear();
    const shown = (garden.foxGifts ?? []).slice(-GIFTS_SHOWN);
    shown.forEach((gift, i) => {
      const [w, h] = GIFT_SIZE[gift.kind] ?? [5, 5];
      const m = flat('gift_' + gift.kind, w, h, i * 0.01);
      const [ox, oy] = GIFT_SPOTS[i % GIFT_SPOTS.length];
      m.position.x = ox;
      m.position.y = oy;
      giftMeshes.add(m);
    });
  };
  syncFoxYard();
  fox.hasFood = () => !!garden.foxFoodAt;
  fox.onAte = () => { garden = foxAte(garden); fox.trust = foxTrust(garden); syncFoxYard(); save(); };
  fox.onGift = kind => { garden = addFoxGift(garden, kind, Date.now()); syncFoxYard(); save(); };

  // --- the tree, keeper of leaves; a sapling at first, it grows over the weeks ---
  const tree = new THREE.Mesh(
    new THREE.PlaneGeometry(TREE.w, TREE.h),
    new THREE.MeshLambertMaterial({ map: loadTex('tree'), transparent: true, alphaTest: 0.01 }),
  );
  scene.add(tree);
  // once full-grown, the tree answers the seasons (multiplies the art's own
  // greens — summer IS the art; the others tint it)
  const SEASON_TINT = { spring: 0xd8f2c4, summer: 0xffffff, autumn: 0xffa055, winter: 0xd8d2e4 } as const;
  const growTree = () => {
    const k = treeScale(garden, Date.now());
    tree.scale.set(k, k, 1);
    tree.position.set(TREE.x, TREE.baseY + (TREE.h * k) / 2, 20); // anchored at its roots
    (tree.material as THREE.MeshLambertMaterial).color.setHex(
      treeMature(garden, Date.now()) ? SEASON_TINT[season(now())] : 0xffffff,
    );
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

  // click the sand and the camera leans in over it; tools appear on the ground
  const GARDEN_VIEW = { cx: 310, cy: 227.5, z: 4 }; // framed on the sand bed
  let zoomed = false;
  let zoomT = 0; // eased toward zoomed in the loop
  const viewNow = { cx: VIRTUAL_W / 2, cy: VIRTUAL_H / 2, z: 1 };
  const tools = new SandTools();
  scene.add(tools.group);

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
      // grab the sky to move the window — but not while leaning over the sand
      if (vy < 140 && !zoomed && zoomT < 0.05) getCurrentWindow().startDragging();
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
  // pointer → world virtual px, seen through wherever the camera is leaning
  const toVirtual = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const rx = (e.clientX - r.left) / px.scale, ry = (e.clientY - r.top) / px.scale;
    return {
      x: viewNow.cx + (rx - VIRTUAL_W / 2) / viewNow.z,
      y: viewNow.cy + (ry - VIRTUAL_H / 2) / viewNow.z,
    };
  };
  const toScene = (p: { x: number; y: number }) =>
    ({ x: p.x - VIRTUAL_W / 2, y: VIRTUAL_H / 2 - p.y });
  const CURSOR_RAKE = 'url(./cursors/rake.png) 4 20, grab';
  const CURSOR_PAW = 'url(./cursors/paw.png) 12 12, pointer';
  let liveStroke: RakeStroke | null = null;
  let smoothed = false; // the board pressed something flat since the last save
  canvas.addEventListener('pointerdown', e => {
    const p = toVirtual(e);
    if (critters.petAt(toScene(p), performance.now() / 1000)) { mew(); return; } // pet > chores
    if (blueSpirit.pokeAt(toScene(p), performance.now() / 1000)) return; // greet the blue spirit
    if (mossSpirit.pokeAt(toScene(p), performance.now() / 1000)) return; // greet the moss spirit
    if (fox.pokeAt(toScene(p), performance.now() / 1000)) return; // the fox startles — she's wild
    {
      // the fox's dish: a click sets out a morsel for her next visit
      const s = toScene(p);
      if (Math.abs(s.x - DISH_X) <= 8 && Math.abs(s.y - -93) <= 6) {
        if (!garden.foxFoodAt) { garden = setOutFood(garden, Date.now()); syncFoxYard(); save(); }
        return;
      }
    }
    const picked = tools.hit(p);
    if (picked) { tools.select(picked); return; }
    const g = classifyGesture(p, SAND_RECT, garden.leaves);
    if (g === 'sweep') {
      garden = sweepLeavesNear(garden, p, 10);
      leaves.sync(garden);
      return;
    }
    if (g === 'rake') {
      if (!zoomed) { zoomed = true; return; } // the garden invites you closer
      if (tools.current === 'ring') {
        garden = addRakeStroke(garden, { points: [p], t: Date.now(), tool: 'ring' });
        sand.redraw(garden, Date.now());
        sandPress();
        void save();
      } else if (tools.current === 'smooth') {
        garden = eraseStrokesNear(garden, p, 4);
        smoothed = true;
        sand.redraw(garden, Date.now());
        startScrape('smooth');
        scrapeMove(0.3); // even a single press whispers
      } else {
        liveStroke = { points: [p], t: Date.now(), tool: tools.current };
        startScrape(tools.current);
      }
      return;
    }
    if (zoomed) zoomed = false; // clicked the open garden — step back
  });
  canvas.addEventListener('pointermove', e => {
    const p = toVirtual(e);
    if (liveStroke) {
      const lastP = liveStroke.points[liveStroke.points.length - 1];
      const dist = Math.hypot(p.x - lastP.x, p.y - lastP.y);
      if (dist >= 2 / viewNow.z) {
        // clamp to the sand bed
        p.x = Math.min(Math.max(p.x, SAND_RECT.x + 1), SAND_RECT.x + SAND_RECT.w - 1);
        p.y = Math.min(Math.max(p.y, SAND_RECT.y + 1), SAND_RECT.y + SAND_RECT.h - 1);
        liveStroke.points.push(p);
        sand.redraw(garden, Date.now(), liveStroke);
        scrapeMove(Math.min(1, (dist * viewNow.z) / 10)); // the pull, audible
      }
      canvas.style.cursor = CURSOR_RAKE;
      return;
    }
    if (e.buttons) {
      const g = classifyGesture(p, SAND_RECT, garden.leaves);
      if (g === 'sweep') {
        garden = sweepLeavesNear(garden, p, 10);
        leaves.sync(garden);
      } else if (g === 'rake' && zoomed && tools.current === 'smooth') {
        garden = eraseStrokesNear(garden, p, 4);
        smoothed = true;
        sand.redraw(garden, Date.now());
        scrapeMove(0.5);
      }
    }
    canvas.style.cursor = critters.catAt(toScene(p))
      ? CURSOR_PAW
      : tools.hit(p) ? 'pointer'
      : classifyGesture(p, SAND_RECT, garden.leaves) === 'none' ? 'default' : CURSOR_RAKE;
  });
  const endStroke = () => {
    endScrape(); // the tool lifts off the sand
    if (liveStroke && liveStroke.points.length > 1) {
      garden = addRakeStroke(garden, liveStroke);
      void save();
    }
    liveStroke = null;
    if (smoothed) { smoothed = false; void save(); }
    sand.redraw(garden, Date.now());
  };
  canvas.addEventListener('pointerup', () => { endStroke(); void save(); });
  canvas.addEventListener('pointerleave', endStroke);
  addEventListener('keydown', e => { if (e.key === 'Escape') zoomed = false; });

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
          } else if (c === 'fox') {
            fox.summon();
          } else if (c === 'foxgift') {
            fox.forceGift = true;
            fox.summon();
          } else if (c.startsWith('foxtrust:')) {
            // dev only: set her opinion of you directly (not saved until a visit ends)
            fox.trust = Number(c.slice(9));
          } else if (c.startsWith('food:')) {
            // dev only: set out / clear the morsel
            garden = c.slice(5) === '1' ? setOutFood(garden, Date.now())
              : (({ foxFoodAt: _, ...rest }) => rest)(garden);
            syncFoxYard();
          } else if (c.startsWith('foxpoke:')) {
            // dev only: a click at her sitting spot, offset by <dx>
            const dx = Number(c.slice(8)) || 0;
            fox.pokeAt({ x: fox.group.position.x + dx, y: -88 }, performance.now() / 1000);
          } else if (c.startsWith('zoom:')) {
            zoomed = c.slice(5) === '1';
          } else if (c.startsWith('tool:')) {
            tools.select(c.slice(5) as ToolId);
          } else if (c.startsWith('stroke:')) {
            const pts = c.slice(7).split(';').map(s => {
              const [x, y] = s.split(',').map(Number);
              return { x, y };
            });
            const tool = tools.current === 'smooth' ? 'rake' : tools.current;
            if (tool === 'ring') garden = addRakeStroke(garden, { points: [pts[0]], t: Date.now(), tool });
            else garden = addRakeStroke(garden, { points: pts, t: Date.now(), tool });
            sand.redraw(garden, Date.now());
          }
        }
      } catch { /* dev server gone */ }
    }, 1500);
  }

  startMusicBox(); // the shrine hums to itself

  // --- the loop ---
  let last = performance.now();
  let treeSway = 0; // eases in and out so the wind toggle never snaps the trunk
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

    // the tree leans with the wind — rotated about its center, then shifted so
    // the roots stay planted (small-angle pivot at the base)
    treeSway += ((ambientPlaying('wind') ? 1 : 0) - treeSway) * Math.min(1, dt * 1.2);
    const lean = treeSway * (wind * 0.045 + Math.sin(t * 2.7) * 0.010);
    tree.rotation.z = lean;
    tree.position.x = TREE.x - Math.sin(lean) * (TREE.h * treeK) / 2;

    // the garden close-up — the camera leans in over the sand and back out
    zoomT += ((zoomed ? 1 : 0) - zoomT) * Math.min(1, dt * 6);
    if (Math.abs((zoomed ? 1 : 0) - zoomT) < 0.002) zoomT = zoomed ? 1 : 0;
    const ez = zoomT * zoomT * (3 - 2 * zoomT); // smoothstep: gentle at both ends
    viewNow.cx = VIRTUAL_W / 2 + (GARDEN_VIEW.cx - VIRTUAL_W / 2) * ez;
    viewNow.cy = VIRTUAL_H / 2 + (GARDEN_VIEW.cy - VIRTUAL_H / 2) * ez;
    // interpolate the visible width, not the zoom factor, so the glide feels even
    viewNow.z = VIRTUAL_W / (VIRTUAL_W + (VIRTUAL_W / GARDEN_VIEW.z - VIRTUAL_W) * ez);
    camera.zoom = viewNow.z;
    camera.position.x = viewNow.cx - VIRTUAL_W / 2;
    camera.position.y = VIRTUAL_H / 2 - viewNow.cy;
    camera.updateProjectionMatrix();
    sand.setZoomed(zoomT > 0.5);
    tools.fade(ez);

    sky.update(d, t);
    moths.update(t, timeOfDay(d) === 'night' && lights.candlesLit);
    lanternBugs.update(t, timeOfDay(d) === 'dusk' || timeOfDay(d) === 'night');
    critters.update(t, dt, timeOfDay(d) === 'night' || ambientPlaying('rain')); // the cat won't sit out in the rain
    falling.update(dt, t);
    clouds.update(dt, t, ambientPlaying('rain'));
    rainFx.update(dt, t, ambientPlaying('rain'));
    windWisps.update(dt, t, ambientPlaying('wind'));
    blueSpirit.update(dt, t, ambientPlaying('rain'), timeOfDay(d) === 'night', zoomed || zoomT > 0.05);
    mossSpirit.update(dt, t, timeOfDay(d) === 'dusk' || timeOfDay(d) === 'night');
    fox.update(dt, t, ambientPlaying('rain'));

    px.frame(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();
}

boot();
