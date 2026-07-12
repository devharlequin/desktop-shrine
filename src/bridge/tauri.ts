import { invoke } from '@tauri-apps/api/core';
import { parseGarden, serializeGarden, type Garden } from '../core/garden';
import { formatLedgerEntry, localDate } from '../core/ledger';
import type { OfferingMeta, TakeResult } from '../core/offering';
import type { ShrineBridge } from './types';

interface KeeperVerdict { description: string; words: string | null; responses: string[] }
interface PendingItem { path: string; name: string }

export class TauriBridge implements ShrineBridge {
  kind = 'tauri' as const;

  async loadGarden(): Promise<Garden> {
    const read = async (name: string) => {
      try {
        return parseGarden(await invoke<string>('read_text', { path: name }));
      } catch {
        return parseGarden(null);
      }
    };
    const g = await read('garden.json');
    const bare = !g.offeringCount && !g.rakeStrokes.length && !g.leaves.length && !g.plantedAt;
    if (!bare) return g;
    // an empty read where a garden once stood — a failed read must never
    // become a fresh garden that the next save makes permanent
    const bak = await read('garden.json.bak');
    const bakBare = !bak.offeringCount && !bak.rakeStrokes.length && !bak.leaves.length && !bak.plantedAt;
    return bakBare ? g : bak;
  }

  async saveGarden(g: Garden): Promise<void> {
    await invoke('write_text', { path: 'garden.json', content: serializeGarden(g) });
  }

  async takeOffering(m: OfferingMeta): Promise<TakeResult> {
    // 1. the gift is made safe FIRST — locked file etc -> polite refusal
    let kept: string;
    try {
      kept = await invoke<string>('move_to_reliquary', { src: m.path });
    } catch {
      return { ok: false, responses: [] };
    }

    // 2. summon the keeper
    try {
      const v = await invoke<KeeperVerdict>('summon_keeper', {
        offeringPath: kept,
        offeringName: m.name,
      });
      return { ok: true, responses: v.responses };
    } catch {
      // keeper unavailable: minimal ledger line now, queue for next launch
      await invoke('append_ledger', {
        entry: formatLedgerEntry({
          date: localDate(Date.now()),
          name: m.name,
          description: 'An offering, received while the keeper was away.',
          words: null,
          responses: [],
        }),
      }).catch(() => {});
      await this.queuePending({ path: kept, name: m.name });
      return { ok: true, responses: ['bow-lingered'] }; // the shrine still bows
    }
  }

  private async queuePending(item: PendingItem) {
    let q: PendingItem[] = [];
    try {
      q = JSON.parse(await invoke<string>('read_text', { path: 'pending.json' }));
    } catch { /* empty queue */ }
    q.push(item);
    await invoke('write_text', { path: 'pending.json', content: JSON.stringify(q) });
  }

  /** Call once at startup: the keeper receives anything that queued while away. */
  async processPending(): Promise<string[]> {
    let q: PendingItem[] = [];
    try {
      q = JSON.parse(await invoke<string>('read_text', { path: 'pending.json' }));
    } catch {
      return [];
    }
    if (!q.length) return [];
    const all: string[] = [];
    const remaining = [...q];
    for (const item of q) {
      try {
        const v = await invoke<KeeperVerdict>('summon_keeper', {
          offeringPath: item.path,
          offeringName: item.name,
        });
        all.push(...v.responses);
        remaining.shift();
      } catch {
        break; // still away; keep the rest queued
      }
    }
    await invoke('write_text', { path: 'pending.json', content: JSON.stringify(remaining) });
    return all;
  }
}
