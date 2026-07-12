/** The shrine's few sounds, all synthesized — no assets, no noise.
 *  Everything respects the mute toggle (persisted). */

let ac: AudioContext | null = null;
const ctx = () => (ac ??= new AudioContext());

const MUTE_KEY = 'shrine.muted';
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* no storage */ }

// the music box alone can be hushed, for those who want only the weather
const MUSIC_KEY = 'shrine.musicMuted';
let musicMuted = false;
try { musicMuted = localStorage.getItem(MUSIC_KEY) === '1'; } catch { /* no storage */ }

export function isMusicMuted() { return musicMuted; }
export function setMusicMuted(m: boolean) {
  musicMuted = m;
  try { localStorage.setItem(MUSIC_KEY, m ? '1' : '0'); } catch { /* no storage */ }
}

export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* no storage */ }
  for (const k of Object.keys(ambients) as Ambient[]) {
    const amb = ambients[k];
    if (amb) rampTo(amb.gain, m ? 0 : amb.vol, 1.2);
  }
}

// ---------------------------------------------------------------------------
// Ambient murmurs: rain and wind, for working beside the shrine. Looping
// filtered noise, a soft murmur — nothing that demands to be listened to.
// ---------------------------------------------------------------------------

type Ambient = 'rain' | 'wind';
const AMB_KEY = (k: Ambient) => `shrine.ambient.${k}`;
const ambients: Partial<Record<Ambient, { gain: GainNode; vol: number; stop: () => void }>> = {};

let noiseBuf: AudioBuffer | null = null;
function noiseSource(a: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

function rampTo(g: GainNode, v: number, secs: number) {
  const t = g.context.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
  g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0001), t + secs);
}

function buildAmbient(a: AudioContext, kind: Ambient) {
  const src = noiseSource(a);
  const gain = a.createGain();
  gain.gain.value = 0.0001;
  const lfo = a.createOscillator();
  const lfoGain = a.createGain();
  lfo.type = 'sine';

  if (kind === 'rain') {
    // Rain is broadband, not tonal. Two layers, both filtered noise, no
    // oscillators: a continuous "wash" (the sheet of falling water) plus a
    // dense scatter of tiny noise grains (the spatter on stone and leaves).
    // ---- the wash: steady noise shaped to a rain band, leaning on a slow LFO
    const hp = a.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 440;
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3400;
    lfo.frequency.value = 0.13;
    lfoGain.gain.value = 500; // the sheet swells and eases, now and then
    lfo.connect(lfoGain).connect(lp.frequency);
    const wash = a.createGain();
    wash.gain.value = 0.42; // the wash sits under the patter
    src.connect(hp).connect(lp).connect(wash).connect(gain).connect(a.destination);
    src.start();
    lfo.start();
    // ---- the patter: short grains of band-passed noise, scattered densely.
    // each is a spatter, not a pitched drop — that's what kept it from sounding
    // like rain before (tuned sines read as bloops).
    let alive = true;
    const grain = () => {
      if (!alive) return;
      try {
        const g = noiseSource(a);                 // reuse the shared noise buffer
        const bp = a.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 650 + Math.random() * 2900; // rain band, kept low so it patters not crackles
        bp.Q.value = 0.6 + Math.random() * 1.1;
        const env = a.createGain();
        const t0 = a.currentTime;
        const dur = 0.010 + Math.random() * 0.028;
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.exponentialRampToValueAtTime(0.4 + Math.random() * 0.8, t0 + 0.0015);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        g.connect(bp).connect(env).connect(gain);  // through the master, so mute/fades carry it
        g.start(t0, Math.random() * 1.8);           // random slice, so grains don't repeat
        g.stop(t0 + dur + 0.02);
      } catch { /* one drop missed */ }
      setTimeout(grain, 14 + Math.random() * 46);   // dense and irregular
    };
    setTimeout(grain, 200);
    return { gain, vol: 0.06, stop: () => { alive = false; src.stop(); lfo.stop(); } };
  }

  // wind: low rounded noise with slow gusts wandering the filter
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  lp.Q.value = 1.1;
  lfo.frequency.value = 0.06;
  lfoGain.gain.value = 220;
  lfo.connect(lfoGain).connect(lp.frequency);
  src.connect(lp).connect(gain).connect(a.destination);
  src.start();
  lfo.start();
  return { gain, vol: 0.09, stop: () => { src.stop(); lfo.stop(); } };
}

/** Whether an ambient loop is actually running (for the visuals to follow). */
export function ambientPlaying(k: Ambient) { return !!ambients[k]; }

export function isAmbientOn(k: Ambient) {
  try { return localStorage.getItem(AMB_KEY(k)) === '1'; } catch { return !!ambients[k]; }
}

export function setAmbient(k: Ambient, on: boolean) {
  try { localStorage.setItem(AMB_KEY(k), on ? '1' : '0'); } catch { /* no storage */ }
  try {
    const a = ctx();
    if (a.state === 'suspended') void a.resume();
    if (on && !ambients[k]) {
      const b = buildAmbient(a, k);
      ambients[k] = b;
      if (!muted) rampTo(b.gain, b.vol, 2.0);
    } else if (!on && ambients[k]) {
      const amb = ambients[k]!;
      delete ambients[k];
      rampTo(amb.gain, 0, 1.5);
      setTimeout(() => { try { amb.stop(); } catch { /* already gone */ } }, 1600);
    }
  } catch { /* the weather stays outside */ }
}

/** Restore persisted ambient loops (call once at boot). */
export function resumeAmbients() {
  const wanted = (['rain', 'wind'] as Ambient[]).filter(isAmbientOn);
  if (!wanted.length) return;
  for (const k of wanted) setAmbient(k, true);
  try {
    // browsers hold the context until a gesture; the first touch wakes the weather
    const a = ctx();
    if (a.state === 'suspended') {
      const kick = () => { void a.resume(); document.removeEventListener('pointerdown', kick); };
      document.addEventListener('pointerdown', kick);
    }
  } catch { /* the weather waits */ }
}

// ---------------------------------------------------------------------------
// Sand sounds: the rake's hiss and the grains it turns over — the part of a
// zen garden you hear. A continuous scrape follows the hand; tiny dry ticks
// are single grains tumbling. Each tool moves a different amount of sand.
// ---------------------------------------------------------------------------

type ScrapeKind = 'rake' | 'wide' | 'point' | 'smooth';
const SCRAPE: Record<ScrapeKind, { band: number; q: number; vol: number; grains: number }> = {
  rake:   { band: 2400, q: 0.9, vol: 0.055, grains: 2 }, // three tines, a dry hiss
  wide:   { band: 1700, q: 0.8, vol: 0.075, grains: 3 }, // moves the most sand
  point:  { band: 3200, q: 1.4, vol: 0.040, grains: 1 }, // one thin bright line
  smooth: { band: 1100, q: 0.7, vol: 0.050, grains: 1 }, // a soft low shush
};

let scrape: { src: AudioBufferSourceNode; bp: BiquadFilterNode; g: GainNode; kind: ScrapeKind } | null = null;

/** A single dry grain of sand turning over. */
function grainTick(a: AudioContext, k: number) {
  const g = noiseSource(a);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2800 + Math.random() * 3200;
  bp.Q.value = 2.5;
  const env = a.createGain();
  const t0 = a.currentTime + Math.random() * 0.03;
  const dur = 0.004 + Math.random() * 0.009;
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.05 + 0.11 * k * Math.random(), t0 + 0.001);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(bp).connect(env).connect(a.destination);
  g.start(t0, Math.random() * 1.8);
  g.stop(t0 + dur + 0.02);
}

/** The tool touches the sand. Call before the stroke's first movement. */
export function startScrape(kind: ScrapeKind) {
  if (muted) return;
  try {
    const a = ctx();
    if (a.state === 'suspended') void a.resume();
    endScrape();
    const src = noiseSource(a);
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    const c = SCRAPE[kind];
    bp.frequency.value = c.band;
    bp.Q.value = c.q;
    const g = a.createGain();
    g.gain.value = 0.0001;
    src.connect(bp).connect(g).connect(a.destination);
    src.start(0, Math.random() * 1.8);
    scrape = { src, bp, g, kind };
  } catch { /* the sand stays quiet */ }
}

/** Call on each drawing movement; speed 0..1 drives loudness and brightness.
 *  The scrape swells with the pull and dies as soon as the hand rests. */
export function scrapeMove(speed: number) {
  if (!scrape || muted) return;
  try {
    const a = ctx();
    const c = SCRAPE[scrape.kind];
    const k = Math.min(1, Math.max(0.15, speed));
    const t = a.currentTime;
    scrape.g.gain.cancelScheduledValues(t);
    scrape.g.gain.setTargetAtTime(c.vol * k, t, 0.025);
    scrape.g.gain.setTargetAtTime(0.0001, t + 0.09, 0.06);
    scrape.bp.frequency.setTargetAtTime(c.band * (0.9 + 0.25 * k + Math.random() * 0.1), t, 0.05);
    for (let i = 0; i < c.grains; i++) if (Math.random() < 0.5 + k * 0.5) grainTick(a, k);
  } catch { /* quiet sand */ }
}

/** The tool lifts off the sand. */
export function endScrape() {
  if (!scrape) return;
  const s = scrape;
  scrape = null;
  try {
    rampTo(s.g, 0, 0.12);
    setTimeout(() => { try { s.src.stop(); } catch { /* gone */ } }, 250);
  } catch { /* gone */ }
}

/** The ring stamp pressed into the sand — one soft crunch. */
export function sandPress() {
  if (muted) return;
  try {
    const a = ctx();
    if (a.state === 'suspended') void a.resume();
    const src = noiseSource(a);
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 0.8;
    const g = a.createGain();
    const t0 = a.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    src.connect(bp).connect(g).connect(a.destination);
    src.start(t0, Math.random() * 1.8);
    src.stop(t0 + 0.2);
    for (let i = 0; i < 4; i++) grainTick(a, 0.7);
  } catch { /* pressed in silence */ }
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
  if (!muted && !musicMuted) {
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
