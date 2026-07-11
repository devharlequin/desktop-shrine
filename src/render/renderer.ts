import * as THREE from 'three';

// Flat pixel art: what you author is what you get. Disabling color management
// kills the whole class of sRGB double-transform bugs (textures decoded to
// linear, then output re-encoded — or not — depending on material/pass).
THREE.ColorManagement.enabled = false;

export const VIRTUAL_W = 420;
export const VIRTUAL_H = 260;

/**
 * Renders at native 420x260; the canvas is upscaled by CSS with
 * image-rendering: pixelated (set in index.html), which gives us
 * nearest-neighbor chunky pixels with zero extra render passes.
 */
export class PixelRenderer {
  renderer: THREE.WebGLRenderer;
  scale = 2;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: false,
      preserveDrawingBuffer: true, // reliable canvas readback (screenshots)
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setSize(VIRTUAL_W, VIRTUAL_H, false); // keep drawing buffer virtual-size
    this.renderer.setClearColor(0x000000, 0);           // transparent where no sky
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.scale = Math.max(1, Math.floor(Math.min(innerWidth / VIRTUAL_W, innerHeight / VIRTUAL_H)));
    this.canvas.style.width = `${VIRTUAL_W * this.scale}px`;
    this.canvas.style.height = `${VIRTUAL_H * this.scale}px`;
  }

  frame(scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer.render(scene, camera);
  }
}
