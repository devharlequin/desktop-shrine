import type { Garden } from '../core/garden';
import type { OfferingMeta, TakeResult } from '../core/offering';

export interface ShrineBridge {
  kind: 'tauri' | 'browser';
  loadGarden(): Promise<Garden>;
  saveGarden(g: Garden): Promise<void>;
  /** Move file to reliquary + summon keeper (tauri) OR record-only (browser). */
  takeOffering(m: OfferingMeta): Promise<TakeResult>;
}
