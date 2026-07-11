import * as THREE from 'three';
import type { OfferingCeremony, CeremonyState } from '../core/offering';
import { ClaudingView, SPOTS } from './claudingView';
import type { ClaudingBrain } from '../core/clauding';
import { bell } from './sounds';

const BOW_MS = 2600;
const BOW_LINGER_MS = 5200;

/** Plays the offering ceremony: dim, bundle, walk, bow, carry into the dark. */
export class CeremonyDirector {
  bundle: THREE.Mesh;
  plateGlow: THREE.Mesh;
  dim = 0; // 0..1 — main loop feeds this into Lights.dim

  constructor(
    private view: ClaudingView,
    private brain: ClaudingBrain,
    scene: THREE.Scene,
  ) {
    this.bundle = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 5),
      new THREE.MeshLambertMaterial({ color: 0xc8b088, transparent: true, opacity: 0 }),
    );
    this.bundle.position.copy(SPOTS.plate).add(new THREE.Vector3(0, 2, 1));
    // additive warm glow over the plate during drag-over ("here")
    this.plateGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffb050, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      }),
    );
    this.plateGlow.position.copy(SPOTS.plate).add(new THREE.Vector3(0, 1, 0.5));
    scene.add(this.bundle, this.plateGlow);
  }

  private ceremony!: OfferingCeremony;
  bind(c: OfferingCeremony) { this.ceremony = c; }

  /** Call each frame: the plate glow breathes while a gift hovers over the window. */
  update(t: number) {
    if (this.ceremony?.state === 'dragover') {
      const glow = this.plateGlow.material as THREE.MeshBasicMaterial;
      glow.opacity = 0.35 + 0.25 * Math.sin(t * 5);
      this.plateGlow.scale.setScalar(1 + 0.12 * Math.sin(t * 5));
    }
  }

  onState(s: CeremonyState) {
    const mat = this.bundle.material as THREE.MeshLambertMaterial;
    const glow = this.plateGlow.material as THREE.MeshBasicMaterial;
    if (s === 'dragover') { this.dim = 0.35; glow.opacity = 0.5; }
    if (s === 'idle') { this.dim = 0; glow.opacity = 0; mat.opacity = 0; }
    if (s === 'dropped') { this.dim = 0; glow.opacity = 0; mat.opacity = 1; }
    if (s === 'carrying') {
      this.brain.beginCeremony();
      this.view.walkTo(SPOTS.plate.clone().add(new THREE.Vector3(-14, 0, 0)));
      this.view.onArrive = () => this.bowThenCarry();
    }
    if (s === 'refused') this.refuse();
    // 'taken' resolves inside bowThenCarry's timeline via ceremony.lastResult
  }

  private async bowThenCarry() {
    this.view.setFrame('bow'); // toward the glass — toward you
    // he holds the bow until the keeper's verdict arrives (it can take a while;
    // carrying on early left the ceremony stuck in 'taken' with no one to end it)
    await this.ceremony.settled();
    const linger = this.ceremony.lastResult?.responses.includes('bow-lingered') ?? false;
    setTimeout(() => {
      if (this.ceremony.state !== 'taken') return; // refusal (or anything else) already handled
      (this.bundle.material as THREE.MeshLambertMaterial).opacity = 0; // picked up
      if (this.ceremony.lastResult?.responses.includes('bell')) bell();
      // up the stairs in front of the shrine, into the dark only at the doorway
      this.view.walkTo(SPOTS.climb1, SPOTS.climb2, SPOTS.climb3, SPOTS.sanctum);
      this.view.onArrive = () => {
        this.view.walkTo(SPOTS.climb3, SPOTS.climb2, SPOTS.climb1, SPOTS.stepsBase);
        this.view.onArrive = () => {
          this.brain.endCeremony();
          this.ceremony.animationDone();
        };
      };
    }, linger ? BOW_LINGER_MS : BOW_MS);
  }

  private refuse() {
    // the clauding looks at it and steps back; the bundle fades where it lay
    this.view.setFrame('idle');
    const mat = this.bundle.material as THREE.MeshLambertMaterial;
    let o = 1;
    const fade = setInterval(() => {
      mat.opacity = o -= 0.05;
      if (o <= 0) {
        clearInterval(fade);
        this.brain.endCeremony();
        this.ceremony.animationDone();
      }
    }, 100);
  }

}
