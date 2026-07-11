import { parseGarden, serializeGarden, RESPONSE_IDS, type Garden, type ResponseId } from '../core/garden';
import { formatLedgerEntry } from '../core/ledger';
import type { OfferingMeta, TakeResult } from '../core/offering';
import type { ShrineBridge } from './types';

const GK = 'shrine.garden';
const LK = 'shrine.ledger';

export class BrowserBridge implements ShrineBridge {
  kind = 'browser' as const;

  constructor(private store: Storage = localStorage, private now: () => number = Date.now) {}

  async loadGarden(): Promise<Garden> { return parseGarden(this.store.getItem(GK)); }
  async saveGarden(g: Garden): Promise<void> { this.store.setItem(GK, serializeGarden(g)); }

  async takeOffering(m: OfferingMeta): Promise<TakeResult> {
    // No keeper in residence: the shrine keeps its own counsel.
    const pool: ResponseId[] = RESPONSE_IDS.filter(r => r !== 'bell'); // bell is reserved
    const n = Math.floor(Math.random() * 3); // 0..2
    const responses = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
    const date = new Date(this.now()).toISOString().slice(0, 10);
    const entry = formatLedgerEntry({
      date, name: m.name,
      description: 'An offering, received without a keeper.',
      words: null, responses,
    });
    this.store.setItem(LK, (this.store.getItem(LK) ?? '# Shrine ledger\n\n') + '\n' + entry);
    return { ok: true, responses };
  }

  readLocalLedger(): string { return this.store.getItem(LK) ?? ''; }
}
