/** The shrine's few sounds, all synthesized — no assets, no noise. */

let ac: AudioContext | null = null;
const ctx = () => (ac ??= new AudioContext());

/** A tiny mew for a petted cat: a pitch arc with a soft envelope, slightly
 *  different every time so he never repeats himself. */
export function mew() {
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
