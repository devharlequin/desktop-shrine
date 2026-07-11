export interface OfferingMeta { name: string; path: string }
export interface TakeResult { ok: boolean; responses: string[] }
export type TakeOffering = (m: OfferingMeta) => Promise<TakeResult>;
export type CeremonyState = 'idle' | 'dragover' | 'dropped' | 'carrying' | 'taken' | 'refused';

export class OfferingCeremony {
  state: CeremonyState = 'idle';
  lastResult: TakeResult | null = null;
  private pending: Promise<void> | null = null;
  private animDone = false;

  constructor(private take: TakeOffering, private onState: (s: CeremonyState) => void) {}

  private set(s: CeremonyState) { this.state = s; this.onState(s); }

  dragOver() { if (this.state === 'idle') this.set('dragover'); }
  dragLeave() { if (this.state === 'dragover') this.set('idle'); }

  drop(m: OfferingMeta) {
    if (this.state !== 'idle' && this.state !== 'dragover') return;
    this.set('dropped');
    this.set('carrying');
    this.animDone = false;
    // the verdict can take a minute (the keeper contemplates); this promise
    // must never reject, or the shrine locks in 'carrying' for good
    this.pending = this.take(m).then(
      r => { this.lastResult = r; },
      () => { this.lastResult = { ok: false, responses: [] }; },
    ).then(() => {
      this.set(this.lastResult!.ok ? 'taken' : 'refused');
      if (this.animDone) this.set('idle'); // animation already over: don't wait for a call that came
    });
  }

  /** Renderer calls this when the carry/refuse animation completes. */
  animationDone() {
    this.animDone = true;
    if (this.state === 'taken' || this.state === 'refused') this.set('idle');
  }

  async settled() { await (this.pending ?? Promise.resolve()); }
}
