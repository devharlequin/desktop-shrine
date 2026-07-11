import { it, expect } from 'vitest';
import { formatLedgerEntry } from './ledger';

it('formats an entry, silence variant', () => {
  const e = formatLedgerEntry({
    date: '2026-07-10', name: 'old_regrets.txt',
    description: 'A text file; a list of half-finished projects.',
    words: null, responses: ['candles-brighter', 'bow-lingered'],
  });
  expect(e).toBe(
`## 2026-07-10 — "old_regrets.txt"
A text file; a list of half-finished projects. Kept in the reliquary.
> The keeper left no words.
∴ candles-brighter, bow-lingered
`);
});

it('formats an entry with words and no responses', () => {
  const e = formatLedgerEntry({
    date: '2026-07-10', name: 'photo.png', description: 'A photograph.',
    words: 'It was a good day, once.', responses: [],
  });
  expect(e).toContain('> It was a good day, once.');
  expect(e).toContain('∴ (the shrine was still)');
});
