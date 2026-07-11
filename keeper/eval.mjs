// Keeper eval: three sample offerings through the real prompt + real sonnet.
// Run manually: node keeper/eval.mjs   (needs `claude` on PATH; costs ~3 sonnet calls)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'shrine-eval-'));
const ledger = join(dir, 'ledger.md');
const prompt = readFileSync(new URL('./PROMPT.md', import.meta.url), 'utf8');

const samples = [
  ['note.txt', 'today I fixed the bug that had been haunting me for a week. it was a typo.'],
  ['groceries.txt', 'milk, eggs, 2x instant ramen, batteries'],
  ['poem.txt', 'the moon over the parking lot\ndoes not know it is over a parking lot'],
];

const VOCAB = new Set(['bow-lingered', 'candles-brighter', 'incense-thick', 'god-eyes-glow', 'firefly', 'bell']);
const date = new Date().toLocaleDateString('sv'); // YYYY-MM-DD local

let failures = 0;
for (const [name, content] of samples) {
  const p = join(dir, name);
  writeFileSync(p, content);
  const full = prompt
    .replaceAll('{OFFERING_PATH}', p)
    .replaceAll('{OFFERING_NAME}', name)
    .replaceAll('{LEDGER_PATH}', ledger)
    .replaceAll('{DATE}', date);
  // strip session env a parent Claude Code instance would leak into the child
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([k]) => !/^(ANTHROPIC_|CLAUDE_?CODE|CLAUDECODE|CLAUDE_)/i.test(k)));
  const out = execFileSync('claude', [
    '-p', full, '--model', 'sonnet',
    '--allowedTools', 'Read,Edit,Write',
    '--add-dir', dir,
  ], { encoding: 'utf8', shell: true, env });
  const line = out.trim().split('\n').reverse().find(l => l.trim().startsWith('{'));
  const check = (cond, msg) => { if (!cond) { failures++; console.error(`FAIL ${name}: ${msg}`); } };
  let v = null;
  try { v = JSON.parse(line); } catch { }
  check(v, 'no JSON verdict');
  if (v) {
    check(v.ledger_written === true, 'ledger_written not true');
    check(v.responses.length <= 2, 'too many responses');
    check(v.responses.every(r => VOCAB.has(r)), `invented response: ${v.responses}`);
  }
  check(existsSync(ledger) && readFileSync(ledger, 'utf8').includes(`"${name}"`), 'no ledger entry');
  console.log(`ok: ${name} ->`, v?.responses);
}

console.log('\n--- ledger as written by the keeper ---\n');
console.log(readFileSync(ledger, 'utf8'));
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('keeper eval: all pass');
