import * as THREE from 'three';

/** A ribbon of recycled smoke puffs rising from the altar. */
export class Incense {
  group = new THREE.Group();
  density = 1; // 2.2 while 'incense-thick' active
  private puffs: { m: THREE.Mesh; age: number; life: number; seed: number }[] = [];

  constructor(private origin: THREE.Vector3) {
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({ color: 0x9a92b8, transparent: true, opacity: 0 }),
      );
      this.group.add(m);
      this.puffs.push({ m, age: Math.random() * 6, life: 6, seed: Math.random() * 10 });
    }
  }

  update(dt: number, t: number) {
    for (const p of this.puffs) {
      p.age += dt * this.density;
      if (p.age > p.life) { p.age = 0; p.seed = Math.random() * 10; }
      const k = p.age / p.life;
      p.m.position.set(
        this.origin.x + Math.sin(t * 0.6 + p.seed) * (2 + k * 8),
        this.origin.y + k * 55,
        this.origin.z + 1,
      );
      (p.m.material as THREE.MeshBasicMaterial).opacity =
        0.28 * this.density * (1 - k) * Math.min(1, k * 6);
      p.m.scale.setScalar(0.6 + k * 1.8);
    }
  }
}
