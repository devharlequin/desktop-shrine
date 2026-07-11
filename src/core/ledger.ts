export interface LedgerEntry {
  date: string;            // YYYY-MM-DD
  name: string;            // original filename
  description: string;     // one line, ends with '.'
  words: string | null;    // keeper's words, or null for silence
  responses: string[];
}

/** YYYY-MM-DD in LOCAL time — the shrine lives in the user's day, not UTC's. */
export function localDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatLedgerEntry(e: LedgerEntry): string {
  const words = e.words ? `> ${e.words}` : '> The keeper left no words.';
  const resp = e.responses.length ? `∴ ${e.responses.join(', ')}` : '∴ (the shrine was still)';
  return `## ${e.date} — "${e.name}"\n${e.description} Kept in the reliquary.\n${words}\n${resp}\n`;
}
