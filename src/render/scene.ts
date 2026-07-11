import * as THREE from 'three';
import { VIRTUAL_W, VIRTUAL_H } from './renderer';

export interface LayerEntry { rect: [number, number, number, number]; z: number }
export type Manifest = Record<string, LayerEntry>;

const SRC_W = 1600;                  // source art size
export const S = VIRTUAL_W / SRC_W;  // uniform downscale into virtual px

export async function loadManifest(): Promise<Manifest> {
  return (await fetch('./sprites/manifest.json')).json();
}

const texCache = new Map<string, THREE.Texture>();

/** Await every sprite before any quad exists — materials are born complete.
 *  (Textures arriving after material creation proved unreliable on fresh loads.) */
export async function preloadTextures(names: string[]): Promise<void> {
  const loader = new THREE.TextureLoader();
  await Promise.all(names.map(async n => {
    const t = await loader.loadAsync(`./sprites/${n}.png`);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    texCache.set(n, t);
  }));
}

export function loadTex(name: string): THREE.Texture {
  const cached = texCache.get(name);
  if (cached) return cached;
  const t = new THREE.TextureLoader().load(`./sprites/${name}.png`);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  texCache.set(name, t);
  return t;
}

/** Source top-left rect -> centered scene position for a quad. */
export function layerPosition(e: LayerEntry): THREE.Vector3 {
  const [x, y, w, h] = e.rect;
  return new THREE.Vector3(
    (x + w / 2) * S - VIRTUAL_W / 2,
    VIRTUAL_H / 2 - (y + h / 2) * S,
    e.z * 4,
  );
}

/** MeshLambertMaterial so point lights (candles) actually light the flat art. */
export function spriteQuad(name: string, e: LayerEntry): THREE.Mesh {
  const [, , w, h] = e.rect;
  const geo = new THREE.PlaneGeometry(w * S, h * S);
  const mat = new THREE.MeshLambertMaterial({ map: loadTex(name), transparent: true, alphaTest: 0.01 });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(layerPosition(e));
  m.name = name;
  return m;
}

export function makeCamera(): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(
    -VIRTUAL_W / 2, VIRTUAL_W / 2, VIRTUAL_H / 2, -VIRTUAL_H / 2, 0.1, 200,
  );
  cam.position.z = 100;
  return cam;
}

export interface ShrineScene {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  layers: Map<string, THREE.Mesh>;
  manifest: Manifest;
}

export async function buildShrineScene(): Promise<ShrineScene> {
  const scene = new THREE.Scene();
  const camera = makeCamera();
  const manifest = await loadManifest();
  await preloadTextures([...Object.keys(manifest).filter(n => n !== 'sky' && n !== 'stars'), 'broom', 'tree', 'heart', 'bow', 'doorway', 'bed', 'chime', 'cloud1', 'cloud2', 'cloud3', 'spirit_blue', 'twinkle']);
  const layers = new Map<string, THREE.Mesh>();
  for (const [name, e] of Object.entries(manifest)) {
    if (name === 'sky' || name === 'stars') continue; // sky is generated, not sliced
    const q = spriteQuad(name, e);
    layers.set(name, q);
    scene.add(q);
  }
  return { scene, camera, layers, manifest };
}
