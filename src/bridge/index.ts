import type { ShrineBridge } from './types';
import { BrowserBridge } from './browser';

export async function makeBridge(): Promise<ShrineBridge> {
  if ('__TAURI_INTERNALS__' in window) {
    try {
      const mod = './tauri'; // variable + @vite-ignore: module lands in Phase D
      const { TauriBridge } = await import(/* @vite-ignore */ mod);
      return new TauriBridge();
    } catch {
      // fall through — tauri bridge lands in Phase D
    }
  }
  return new BrowserBridge();
}
