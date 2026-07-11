import * as THREE from 'three';
import { timeOfDay } from '../core/clock';

/** three r155+ uses physical light units: point lights need hundreds of candela
 *  to matter at our 20-60px distances with decay 1.8. */
const CANDLE_POWER = 320;
const ALTAR_POWER = 260;

export class Lights {
  ambient = new THREE.AmbientLight(0xffffff, 0.8);
  candleL: THREE.PointLight;
  candleR: THREE.PointLight;
  altarGlow: THREE.PointLight;
  /** external modifiers */
  candlesBoost = 0;   // ~0.5 while 'candles-brighter' active
  candlesLit = true;  // clauding routine flips this at dusk/dawn
  dim = 0;            // 0..1 scene dim during drag-over

  constructor(candleLPos: THREE.Vector3, candleRPos: THREE.Vector3, altarPos: THREE.Vector3) {
    this.candleL = new THREE.PointLight(0xffb050, 0, 90, 1.8);
    this.candleL.position.copy(candleLPos);
    this.candleR = new THREE.PointLight(0xffb050, 0, 90, 1.8);
    this.candleR.position.copy(candleRPos);
    this.altarGlow = new THREE.PointLight(0xff9840, 0, 120, 1.6);
    this.altarGlow.position.copy(altarPos);
  }

  addTo(scene: THREE.Scene) { scene.add(this.ambient, this.candleL, this.candleR, this.altarGlow); }

  update(now: Date, t: number) {
    const tod = timeOfDay(now);
    this.ambient.intensity =
      ({ dawn: 0.55, day: 0.95, dusk: 0.45, night: 0.22 } as const)[tod] * (1 - this.dim);
    const flicker = () => 0.85 + 0.15 * Math.sin(t * 7 + Math.sin(t * 3.1)) * Math.sin(t * 11.7);
    const base = this.candlesLit ? (tod === 'night' ? 2.2 : tod === 'dusk' ? 1.6 : 0.5) : 0;
    this.candleL.intensity = (base + this.candlesBoost) * flicker() * CANDLE_POWER;
    this.candleR.intensity = (base + this.candlesBoost) * flicker() * 0.93 * CANDLE_POWER;
    this.altarGlow.intensity = (0.8 + (tod === 'night' ? 0.6 : 0)) * ALTAR_POWER;
  }
}
