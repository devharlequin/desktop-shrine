// Keeper eval: three sample offerings through the real prompt + real sonnet.
// Run manually: node keeper/eval.mjs   (needs `claude` on PATH; costs ~3 sonnet calls)
// Contract: the keeper is READ-ONLY and returns JSON; the shrine inscribes the ledger.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const dir = mkdtempSync(join(tmpdir(), 'shrine-eval-'));
const prompt = readFileSync(new URL('./PROMPT.md', import.meta.url), 'utf8');

const samples = [
  ['note.txt', 'today I fixed the bug that had been haunting me for a week. it was a typo.'],
  ['groceries.txt', 'milk, eggs, 2x instant ramen, batteries'],
  ['poem.txt', 'the moon over the parking lot\ndoes not know it is over a parking lot'],
];

const VOCAB = new Set(['bow-lingered', 'candles-brighter', 'incense-thick', 'god-eyes-glow', 'firefly', 'bell']);
const date = new Date().toLocaleDateString('sv'); // YYYY-MM-DD local

const formatEntry = (name, v) =>
  `## ${date} — "${name}"\n${v.description} Kept in the reliquary.\n` +
  `${v.words ? `> ${v.words}` : '> The keeper left no words.'}\n` +
  `${v.responses.length ? `∴ ${v.responses.join(', ')}` : '∴ (the shrine was still)'}\n`;

let failures = 0;
const entries = [];
for (const [name, content] of samples) {
  const p = join(dir, name);
  writeFileSync(p, content);
  const full = prompt
    .replaceAll('{OFFERING_PATH}', p)
    .replaceAll('{OFFERING_NAME}', name);
  // strip session env a parent Claude Code instance would leak into the child;
  // prompt via STDIN — multi-line args do not survive the Windows shell
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([k]) => !/^(ANTHROPIC_|CLAUDE_?CODE|CLAUDECODE|CLAUDE_)/i.test(k)));
  const out = execFileSync('claude', [
    '-p', '--model', 'sonnet',
    '--allowedTools', 'Read',
    '--add-dir', dir,
  ], { encoding: 'utf8', shell: true, env, input: full });
  const line = out.trim().split('\n').reverse().find(l => l.trim().startsWith('{'));
  const check = (cond, msg) => { if (!cond) { failures++; console.error(`FAIL ${name}: ${msg}`); } };
  let v = null;
  try { v = JSON.parse(line); } catch { }
  check(v, 'no JSON verdict');
  if (v) {
    check(typeof v.description === 'string' && v.description.length > 4, 'no description');
    check(v.words === null || typeof v.words === 'string', 'bad words field');
    check(Array.isArray(v.responses) && v.responses.length <= 2, 'too many responses');
    check(v.responses.every(r => VOCAB.has(r)), `invented response: ${v.responses}`);
    entries.push(formatEntry(name, v));
  }
  console.log(`ok: ${name} ->`, v?.responses, v?.words ? `"${v.words}"` : '(silence)');
}

console.log('\n--- ledger entries as the shrine would inscribe them ---\n');
console.log(entries.join('\n'));
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('keeper eval: all pass');
