import * as THREE from 'three';

/** Three moths that orbit the candle lights at night. v1's taste of the Hours. */
export class Moths {
  group = new THREE.Group();
  private ms: { m: THREE.Mesh; c: THREE.Vector3; s: number }[] = [];

  constructor(candles: THREE.Vector3[]) {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({ color: 0xe8e2d0, transparent: true }),
      );
      this.group.add(m);
      this.ms.push({ m, c: candles[i % candles.length], s: 1 + Math.random() });
    }
  }

  update(t: number, visible: boolean) {
    this.group.visible = visible;
    if (!visible) return;
    for (const { m, c, s } of this.ms) {
      m.position.set(
        c.x + Math.sin(t * 1.7 * s) * 9 + Math.sin(t * 5.3 * s) * 2,
        c.y + Math.cos(t * 1.3 * s) * 7 + 3,
        c.z + 1,
      );
      (m.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.4 * Math.sin(t * 9 * s);
    }
  }
}
