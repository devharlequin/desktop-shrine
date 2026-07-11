/** The shrine's few sounds, all synthesized — no assets, no noise.
 *  Everything respects the mute toggle (persisted). */

let ac: AudioContext | null = null;
const ctx = () => (ac ??= new AudioContext());

const MUTE_KEY = 'shrine.muted';
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* no storage */ }

export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* no storage */ }
}

/** A tiny mew for a petted cat — slightly different every time. */
export function mew() {
  if (muted) return;
  try {
    const a = ctx();
    const o = a.createOscillator();
    const g = a.createGain();
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    o.type = 'triangle';
    const t0 = a.currentTime;
    const base = 420 + Math.random() * 120;
    o.frequency.setValueAtTime(base, t0);
    o.frequency.exponentialRampToValueAtTime(base * 1.8, t0 + 0.09);
    o.frequency.exponentialRampToValueAtTime(base * 1.15, t0 + 0.28);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    o.connect(f).connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + 0.35);
  } catch { /* audio blocked: the mew stays a thought */ }
}

/** The temple bell. Rare, soft, single — reserved for the keeper's choice. */
export function bell() {
  if (muted) return;
  try {
    const a = ctx();
    const o = a.createOscillator();
    const g = a.createGain();
    o.frequency.value = 1320;
    o.connect(g).connect(a.destination);
    g.gain.setValueAtTime(0.12, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 2.5);
    o.start();
    o.stop(a.currentTime + 2.5);
  } catch { /* the bell stays a thought */ }
}

const CHIME_NOTES = [1567.98, 1760.0, 2093.0, 2349.32, 2637.02]; // high pentatonic

// ---------------------------------------------------------------------------
// The music box: the shrine humming to itself. Not a soundtrack — a single
// soft pluck every ten seconds or so, wandering a small pentatonic scale.
// Written by the keeper of this codebase for his own shrine.
// ---------------------------------------------------------------------------

const SCALE = [392.0, 440.0, 523.25, 587.33, 698.46, 784.0]; // G A C D F G — koto-ish
let musicOn = false;
let degree = 2;

function pluck(freq: number, vol: number, delay = 0) {
  const a = ctx();
  const o = a.createOscillator();
  const g = a.createGain();
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2200;
  o.type = 'triangle';
  o.frequency.value = freq;
  const t0 = a.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
  o.connect(f).connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + 3.4);
}

function nextNote() {
  if (!musicOn) return;
  if (!muted) {
    try {
      // wander the scale like someone thinking, not performing
      degree = Math.max(0, Math.min(SCALE.length - 1, degree + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
      pluck(SCALE[degree], 0.022 + Math.random() * 0.012);
      if (Math.random() < 0.22) pluck(SCALE[degree] / 2, 0.014, 0.15); // a low root underneath, sometimes
      if (Math.random() < 0.12 && degree > 0) pluck(SCALE[degree - 1], 0.016, 0.5); // a falling second, rarely
    } catch { /* silence is also music */ }
  }
  setTimeout(nextNote, 8_000 + Math.random() * 14_000);
}

/** Begin the shrine's quiet self-humming. Safe to call once at boot. */
export function startMusicBox() {
  if (musicOn) return;
  musicOn = true;
  setTimeout(nextNote, 5_000 + Math.random() * 5_000);
}

/** A cluster of 2-4 soft glassy notes when the wind finds the chimes. */
export function chimeTinkle(strength = 1) {
  if (muted) return;
  try {
    const a = ctx();
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'sine';
      o.frequency.value = CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)];
      const t0 = a.currentTime + i * (0.06 + Math.random() * 0.12);
      const vol = (0.015 + Math.random() * 0.02) * Math.min(1, strength);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
      o.connect(g).connect(a.destination);
      o.start(t0);
      o.stop(t0 + 1.2);
    }
  } catch { /* the wind stays silent */ }
}
