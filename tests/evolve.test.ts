import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseProMd } from '../src/core/promd/parse';
import { KernelSession, makeCell } from '../src/core/kernel/kernel';
import { ALL_PACKAGES } from '../src/core/packages';
import { EvolutionStore } from '../src/core/evolve/evolution';

const load = (name: string) =>
  parseProMd(readFileSync(new URL(`../notebooks/${name}`, import.meta.url), 'utf8')).notebook;

describe('modular extension: constants, deps, gap suggestions', () => {
  it('mech attach pulls units transitively and exposes constants via prelude', () => {
    const nb = load('cantilever-beam.pro.md');
    const s = new KernelSession(nb, ALL_PACKAGES);
    expect(s.request({ op: 'load_package', name: 'mech' }).op).toBe('ok');
    expect(s.attachedPackages().map((p) => p.name).sort()).toEqual(['mech', 'units']);
    // only the direct requirement lands in the file; deps re-resolve on open
    expect(nb.meta.packages.map((p) => p.name)).toEqual(['mech']);

    const cell = makeCell({ type: 'code', source: 'sigma_bend(kn(27.0) * 1.0, W_rect(0.1, 0.2)) / E_steel', lang: 'rhai' });
    s.request({ op: 'insert_cell', after: null, cell });
    expect(s.errors.get(cell.id)).toBeUndefined();
    const out = s.outputs.get(cell.id)?.['text/plain'];
    // σ = 27000/6.667e-4 = 4.05e7 Pa; /200e9 = 2.025e-4
    expect(Number(out)).toBeCloseTo(2.025e-4, 6);
  });

  it('suggestionFor points an undefined package symbol at its provider', () => {
    const s = new KernelSession(load('cantilever-beam.pro.md'), ALL_PACKAGES, { evolution: new EvolutionStore() });
    const cell = makeCell({ type: 'code', source: 'sigma_bend(1.0, 2.0)', lang: 'rhai' });
    s.request({ op: 'insert_cell', after: null, cell });
    expect(s.errors.get(cell.id)?.kind).toBe('undefined_symbol');
    const sug = s.suggestionFor(cell.id);
    expect(sug?.symbol).toBe('sigma_bend');
    expect(sug?.pkg.name).toBe('mech');
    // loading the suggestion heals the cell
    s.request({ op: 'load_package', name: 'mech' });
    expect(s.errors.get(cell.id)).toBeUndefined();
    expect(s.suggestionFor(cell.id)).toBeNull();
  });

  it('suggestionFor stays null for plain user typos', () => {
    const s = new KernelSession(load('cantilever-beam.pro.md'), ALL_PACKAGES);
    const cell = makeCell({ type: 'code', source: 'no_such_symbol + 1.0', lang: 'rhai' });
    s.request({ op: 'insert_cell', after: null, cell });
    expect(s.suggestionFor(cell.id)).toBeNull();
  });
});

describe('self-evolution: promoted functions', () => {
  it('promotes a closure and makes it ambient across sessions (incl. new ones)', () => {
    const evolution = new EvolutionStore();
    const a = new KernelSession(load('cantilever-beam.pro.md'), ALL_PACKAGES, { evolution });
    const b = new KernelSession(load('rf-link-budget.pro.md'), ALL_PACKAGES, { evolution });

    const def = makeCell({ type: 'code', source: 'let margin_ratio = |value, limit| value / limit;\nmargin_ratio(6.67, 8.0)', lang: 'rhai' });
    a.request({ op: 'insert_cell', after: null, cell: def });
    expect(a.closuresOf(def.id)).toEqual(['margin_ratio']);

    expect(a.request({ op: 'promote_function', cellId: def.id, symbol: 'margin_ratio' }).op).toBe('ok');
    expect(evolution.version).toBe('1.0.1');
    expect(evolution.learned.get('margin_ratio')?.source).toContain('let margin_ratio');

    // already-open sibling session can call it immediately
    const useB = makeCell({ type: 'code', source: 'margin_ratio(50.0, 100.0)', lang: 'rhai' });
    b.request({ op: 'insert_cell', after: null, cell: useB });
    expect(b.errors.get(useB.id)).toBeUndefined();
    expect(Number(b.outputs.get(useB.id)?.['text/plain'])).toBeCloseTo(0.5, 9);

    // a brand-new session inherits the learned library on construction
    const c = new KernelSession(load('cantilever-beam.pro.md'), ALL_PACKAGES, { evolution });
    const useC = makeCell({ type: 'code', source: 'margin_ratio(1.0, 4.0)', lang: 'rhai' });
    c.request({ op: 'insert_cell', after: null, cell: useC });
    expect(Number(c.outputs.get(useC.id)?.['text/plain'])).toBeCloseTo(0.25, 9);

    // usage telemetry counted the two call-site references
    expect(evolution.learned.get('margin_ratio')!.usage).toBeGreaterThanOrEqual(2);
    expect(c.capabilities).toContain('evolve');
  });

  it('re-promoting replaces the definition and bumps the version', () => {
    const evolution = new EvolutionStore();
    const s = new KernelSession(load('cantilever-beam.pro.md'), ALL_PACKAGES, { evolution });
    const v1 = makeCell({ type: 'code', source: 'let ratio = |x| x / 2.0;\nratio(4.0)', lang: 'rhai' });
    s.request({ op: 'insert_cell', after: null, cell: v1 });
    s.request({ op: 'promote_function', cellId: v1.id, symbol: 'ratio' });
    expect(evolution.version).toBe('1.0.1');

    s.request({ op: 'update_cell', cellId: v1.id, source: 'let ratio = |x| x / 4.0;\nratio(4.0)' });
    s.request({ op: 'promote_function', cellId: v1.id, symbol: 'ratio' });
    expect(evolution.version).toBe('1.0.2');

    const fresh = new KernelSession(load('rf-link-budget.pro.md'), ALL_PACKAGES, { evolution });
    const use = makeCell({ type: 'code', source: 'ratio(8.0)', lang: 'rhai' });
    fresh.request({ op: 'insert_cell', after: null, cell: use });
    expect(Number(fresh.outputs.get(use.id)?.['text/plain'])).toBeCloseTo(2.0, 9); // new edition
  });

  it('rejects promoting a non-closure and survives serialization round-trip', () => {
    const evolution = new EvolutionStore();
    const s = new KernelSession(load('cantilever-beam.pro.md'), ALL_PACKAGES, { evolution });
    const num = makeCell({ type: 'code', source: 'let plain = 42.0;\nplain', lang: 'rhai' });
    s.request({ op: 'insert_cell', after: null, cell: num });
    expect(s.request({ op: 'promote_function', cellId: num.id, symbol: 'plain' }).op).toBe('err');

    const fn = makeCell({ type: 'code', source: 'let dbl = |x| x * 2.0;\ndbl(1.0)', lang: 'rhai' });
    s.request({ op: 'insert_cell', after: null, cell: fn });
    s.request({ op: 'promote_function', cellId: fn.id, symbol: 'dbl' });

    // learned library round-trips as JSON (workspace persistence contract)
    const restored = new EvolutionStore();
    restored.hydrate(evolution.serialize());
    expect(restored.version).toBe(evolution.version);
    const t = new KernelSession(load('rf-link-budget.pro.md'), ALL_PACKAGES, { evolution: restored });
    const use = makeCell({ type: 'code', source: 'dbl(21.0)', lang: 'rhai' });
    t.request({ op: 'insert_cell', after: null, cell: use });
    expect(Number(t.outputs.get(use.id)?.['text/plain'])).toBeCloseTo(42.0, 9);
  });
});
