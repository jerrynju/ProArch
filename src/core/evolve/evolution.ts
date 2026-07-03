// Self-evolution layer: the workspace grows its own capability library from
// the user's actual work. Three loops feed it:
//
//  1. capability gaps — a cell fails on an undefined symbol, the registry is
//     asked who provides it, and the gap (plus its resolution options) is
//     recorded so the UI/agent can self-heal by attaching the package;
//  2. promoted functions — a closure defined in one notebook cell can be
//     promoted ("沉淀") into the workspace-level `learned` package: it becomes
//     ambient in every open session, current and future, and the learned
//     package version auto-bumps on every promotion;
//  3. usage telemetry — reference counts per package/learned function, so the
//     system knows which capabilities earn their keep.
//
// The store is deliberately framework-free and serializable: in the full
// product it persists as a workspace package (~/.proarch/learned.pkg); here
// its lifetime is the app session, exactly like kernel state.

export interface LearnedFn {
  name: string;
  /** rhai source of the definition, a single `let name = |…| …;` statement */
  source: string;
  doc: string;
  origin?: { notebook: string; cellId: string };
  usage: number;
  addedAt: number;
}

export interface CapabilityGap {
  symbol: string;
  providers: string[]; // package names that could fill the gap
  ts: number;
}

export type EvolutionEvent =
  | { ev: 'promoted'; fn: LearnedFn; version: string }
  | { ev: 'hydrated' };

export class EvolutionStore {
  learned = new Map<string, LearnedFn>();
  gaps: CapabilityGap[] = [];
  /** reference counts per package/learned symbol across all sessions */
  fnUsage = new Map<string, number>();
  private patch = 0;
  private listeners = new Set<(e: EvolutionEvent) => void>();

  get version(): string {
    return `1.0.${this.patch}`;
  }

  subscribe(fn: (e: EvolutionEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: EvolutionEvent) {
    for (const fn of this.listeners) fn(e);
  }

  /** Promote a closure definition into the workspace library. Re-promoting
   * the same name replaces the definition (a new "edition" of the function);
   * either way the learned package version bumps. */
  promote(fn: Omit<LearnedFn, 'usage' | 'addedAt'>): { version: string; replaced: boolean } {
    const replaced = this.learned.has(fn.name);
    const prev = this.learned.get(fn.name);
    this.learned.set(fn.name, { ...fn, usage: prev?.usage ?? 0, addedAt: Date.now() });
    this.patch += 1;
    const version = this.version;
    this.emit({ ev: 'promoted', fn: this.learned.get(fn.name)!, version });
    return { version, replaced };
  }

  /** telemetry only — never emits, so it can run inside recompute loops */
  bumpUsage(symbol: string) {
    this.fnUsage.set(symbol, (this.fnUsage.get(symbol) ?? 0) + 1);
    const lf = this.learned.get(symbol);
    if (lf) lf.usage += 1;
  }

  recordGap(symbol: string, providers: string[]) {
    // dedupe consecutive identical gaps (recompute loops re-surface them)
    const last = this.gaps[this.gaps.length - 1];
    if (last && last.symbol === symbol) return;
    this.gaps.push({ symbol, providers, ts: Date.now() });
    if (this.gaps.length > 100) this.gaps.shift();
  }

  docs(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const fn of this.learned.values()) out[fn.name] = fn.doc;
    return out;
  }

  serialize(): string {
    return JSON.stringify({ patch: this.patch, learned: [...this.learned.values()] });
  }

  hydrate(json: string) {
    const data = JSON.parse(json) as { patch: number; learned: LearnedFn[] };
    this.patch = data.patch;
    this.learned = new Map(data.learned.map((f) => [f.name, f]));
    this.emit({ ev: 'hydrated' });
  }
}
