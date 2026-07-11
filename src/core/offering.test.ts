import { it, expect, vi } from 'vitest';
import { OfferingCeremony } from './offering';

const meta = { name: 'gift.txt', path: 'C:/tmp/gift.txt' };

it('walks the happy path: dragover->dropped->carrying->taken->idle', async () => {
  const take = vi.fn().mockResolvedValue({ ok: true, responses: ['bow-lingered'] });
  const seen: string[] = [];
  const c = new OfferingCeremony(take, s => seen.push(s));
  c.dragOver();
  c.drop(meta);
  await c.settled();
  c.animationDone();
  expect(seen).toEqual(['dragover', 'dropped', 'carrying', 'taken', 'idle']);
  expect(take).toHaveBeenCalledWith(meta);
});

it('refuses politely when the bridge fails the move', async () => {
  const take = vi.fn().mockResolvedValue({ ok: false, responses: [] });
  const seen: string[] = [];
  const c = new OfferingCeremony(take, s => seen.push(s));
  c.drop(meta);
  await c.settled();
  c.animationDone();
  expect(seen).toEqual(['dropped', 'carrying', 'refused', 'idle']);
});

it('ignores drops while a ceremony is in progress', async () => {
  const take = vi.fn().mockResolvedValue({ ok: true, responses: [] });
  const c = new OfferingCeremony(take, () => {});
  c.drop(meta);
  c.drop(meta); // ignored
  await c.settled();
  expect(take).toHaveBeenCalledTimes(1);
});

it('recovers when the animation finishes before a slow keeper answers (lockout bug)', async () => {
  let resolve!: (r: { ok: boolean; responses: string[] }) => void;
  const take = vi.fn().mockReturnValue(new Promise(res => { resolve = res; }));
  const seen: string[] = [];
  const c = new OfferingCeremony(take, s => seen.push(s));
  c.drop(meta);
  c.animationDone();               // the walk ended while the keeper still contemplates
  resolve({ ok: true, responses: [] }); // ...a minute later, the verdict
  await c.settled();
  expect(c.state).toBe('idle');    // not stuck in 'taken'
  c.drop(meta);                    // the next gift must be welcome
  expect(take).toHaveBeenCalledTimes(2);
});

it('dragleave returns to idle without a ceremony', () => {
  const seen: string[] = [];
  const c = new OfferingCeremony(async () => ({ ok: true, responses: [] }), s => seen.push(s));
  c.dragOver();
  c.dragLeave();
  expect(seen).toEqual(['dragover', 'idle']);
});
