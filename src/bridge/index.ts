import type { ShrineBridge } from './types';
import { BrowserBridge } from './browser';

export async function makeBridge(): Promise<ShrineBridge> {
  if ('__TAURI_INTERNALS__' in window) {
    const { TauriBridge } = await import('./tauri');
    return new TauriBridge();
  }
  return new BrowserBridge();
}
