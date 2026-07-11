import * as THREE from 'three';
import { VIRTUAL_W, VIRTUAL_H } from './renderer';
import { timeOfDay, dayPhaseBlend, moonPhase, type TimeOfDay } from '../core/clock';

const SKY: Record<TimeOfDay, [THREE.Color, THREE.Color]> = { // [top, horizon]
  dawn:  [new THREE.Color('#2a2440'), new THREE.Color('#8a5a6a')],
  day:   [new THREE.Color('#4a5a8a'), new THREE.Color('#8a94b8')],
  dusk:  [new THREE.Color('#241f3a'), new THREE.Color('#b06a3a')],
  night: [new THREE.Color('#1a152a'), new THREE.Color('#262138')],
};

const NEXT: Record<TimeOfDay, TimeOfDay> = { dawn: 'day', day: 'dusk', dusk: 'night', night: 'dawn' };

export class Sky {
  mesh: THREE.Mesh;
  stars: THREE.Points;
  moon: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(moonTex: THREE.Texture) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { top: { value: SKY.night[0].clone() }, bot: { value: SKY.night[1].clone() } },
      vertexShader:
        'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec2 vUv; uniform vec3 top,bot; void main(){gl_FragColor=vec4(mix(bot,top,vUv.y),1.);}',
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(VIRTUAL_W, VIRTUAL_H), this.mat);
    this.mesh.position.z = -50;

    const n = 90;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * VIRTUAL_W;
      pos[i * 3 + 1] = Math.random() * VIRTUAL_H * 0.45 + VIRTUAL_H * 0.05;
      pos[i * 3 + 2] = -49;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xbcb8dc, size: 1, sizeAttenuation: false, transparent: true }),
    );

    this.moon = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshBasicMaterial({ map: moonTex, transparent: true }),
    );
    this.moon.position.set(VIRTUAL_W * 0.34, VIRTUAL_H * 0.32, -48);
  }

  addTo(scene: THREE.Scene) { scene.add(this.mesh, this.stars, this.moon); }

  update(now: Date, t: number) {
    const tod = timeOfDay(now);
    const b = dayPhaseBlend(now);
    (this.mat.uniforms.top.value as THREE.Color).lerpColors(SKY[tod][0], SKY[NEXT[tod]][0], b);
    (this.mat.uniforms.bot.value as THREE.Color).lerpColors(SKY[tod][1], SKY[NEXT[tod]][1], b);
    const starAlpha = tod === 'night' ? 1 : tod === 'dusk' ? b : tod === 'dawn' ? 1 - b : 0;
    const m = this.stars.material as THREE.PointsMaterial;
    m.opacity = starAlpha * (0.7 + 0.3 * Math.sin(t * 0.8)); // gentle collective twinkle
    const moonMat = this.moon.material as THREE.MeshBasicMaterial;
    moonMat.opacity = starAlpha;
    // crude but honest phase: horizontal squash of the crescent toward new moon
    const p = moonPhase(now);                 // 0 new .. 0.5 full
    const illum = 1 - Math.abs(p - 0.5) * 2;  // 0..1
    this.moon.scale.x = 0.3 + 0.7 * illum;
  }
}
