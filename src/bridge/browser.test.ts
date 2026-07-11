import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserBridge } from './browser';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

describe('BrowserBridge', () => {
  let b: BrowserBridge;
  beforeEach(() => {
    b = new BrowserBridge(memStorage(), () => Date.parse('2026-07-10T12:00:00'));
  });

  it('round-trips garden', async () => {
    const g = await b.loadGarden();
    g.offeringCount = 7;
    await b.saveGarden(g);
    expect((await b.loadGarden()).offeringCount).toBe(7);
  });

  it('takes an offering: always ok, picks 0-2 responses, appends local ledger', async () => {
    const r = await b.takeOffering({ name: 'gift.txt', path: '' });
    expect(r.ok).toBe(true);
    expect(r.responses.length).toBeLessThanOrEqual(2);
    expect(r.responses).not.toContain('bell'); // bell is reserved for the keeper
    expect(b.readLocalLedger()).toContain('"gift.txt"');
  });
});
