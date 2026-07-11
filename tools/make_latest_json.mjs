// Compose latest.json for the auto-updater from the freshly built NSIS bundle.
// Run AFTER `npx tauri build` (with signing env set):  node tools/make_latest_json.mjs
// Then attach latest.json + the -setup.exe + the -setup.exe.sig to the GitHub release.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const conf = JSON.parse(readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const version = conf.version;
const bundleDir = join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis');

const setup = readdirSync(bundleDir).find(f => f === `shrine_${version}_x64-setup.exe`);
if (!setup) throw new Error(`no shrine_${version}_x64-setup.exe in ${bundleDir} — build first?`);
const sig = readFileSync(join(bundleDir, `${setup}.sig`), 'utf8').trim();

const manifest = {
  version,
  notes: `Shrine of Fable v${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: sig,
      url: `https://github.com/devharlequin/desktop-shrine/releases/download/v${version}/${setup}`,
    },
  },
};

const out = join(bundleDir, 'latest.json');
writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(`wrote ${out} for v${version}`);
