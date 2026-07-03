import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseProMd } from '../src/core/promd/parse';
import { KernelSession } from '../src/core/kernel/kernel';
import { ALL_PACKAGES } from '../src/core/packages';

const load = (name: string) =>
  parseProMd(readFileSync(new URL(`../notebooks/${name}`, import.meta.url), 'utf8')).notebook;

describe('beam notebook golden values', () => {
  it('computes δ_max = F·L³/(3EI) with unit conversions', () => {
    const s = new KernelSession(load('cantilever-beam.pro.md'));
    // F=10kN, L=2m, E=200GPa, I=2000cm⁴ → δ = 80000/1.2e7 m = 6.667 mm
    const delta = s.currentValue('delta_mm');
    expect(delta).toBeCloseTo(6.6667, 3);
    const allowable = s.currentValue('allowable_mm');
    expect(allowable).toBeCloseTo(8.0, 6);
    const check = s.outputs.get('beam-verify')?.['application/vnd.proarch.check+json'];
    expect(check?.pass).toBe(true);
  });

  it('verification flips at the L/250 boundary', () => {
    const s = new KernelSession(load('cantilever-beam.pro.md'));
    s.request({ op: 'set_param', cellId: 'beam-params-F', value: 13 }); // δ=8.67 > 8
    const check = s.outputs.get('beam-verify')?.['application/vnd.proarch.check+json'];
    expect(check?.pass).toBe(false);
    expect(check?.message).toContain('未通过');
  });

  it('material cell errors on undefined I_section with a hint', () => {
    const s = new KernelSession(load('cantilever-beam.pro.md'));
    const err = s.errors.get('beam-material');
    expect(err?.kind).toBe('undefined_symbol');
    expect(err?.message).toContain('I_section');
    expect(err?.hint).toBeTruthy();
  });

  it('produces a plot bundle with matching x/y lengths', () => {
    const s = new KernelSession(load('cantilever-beam.pro.md'));
    const plot = s.outputs.get('beam-plot')?.['application/vnd.proarch.plot+json'];
    expect(plot?.x.length).toBe(24);
    expect(plot?.y.length).toBe(24);
    // free-end deflection equals delta_mm
    expect(plot!.y[plot!.y.length - 1]).toBeCloseTo(s.currentValue('delta_mm') as number, 6);
  });
});

describe('rf notebook (domain package)', () => {
  it('fspl comes from the rf package, not core', () => {
    const noPkg = new KernelSession(load('rf-link-budget.pro.md'), []);
    expect(noPkg.errors.get('rf-compute')?.kind).toBe('undefined_symbol');

    const s = new KernelSession(load('rf-link-budget.pro.md'), ALL_PACKAGES);
    expect(s.errors.get('rf-compute')).toBeUndefined();
    // FSPL(10km, 9.4GHz) ≈ 131.9 dB → Pr ≈ -66.9 dBm
    const pr = s.currentValue('Pr') as number;
    expect(pr).toBeCloseTo(-66.9, 0.5);
    const check = s.outputs.get('rf-verify')?.['application/vnd.proarch.check+json'];
    expect(check?.pass).toBe(true);
  });

  it('capabilities include pkg.rf', () => {
    const s = new KernelSession(load('rf-link-budget.pro.md'), ALL_PACKAGES);
    expect(s.capabilities).toContain('pkg.rf');
  });

  it('link margin fails at long distance', () => {
    const s = new KernelSession(load('rf-link-budget.pro.md'), ALL_PACKAGES);
    s.request({ op: 'set_param', cellId: 'rf-params-dist', value: 50 });
    const check = s.outputs.get('rf-verify')?.['application/vnd.proarch.check+json'];
    expect(check?.pass).toBe(false);
  });

  it('symbolsOf splits notebook symbols from package functions', () => {
    const s = new KernelSession(load('rf-link-budget.pro.md'), ALL_PACKAGES);
    const { userSyms, pkgFns } = s.symbolsOf('rf-compute');
    expect(pkgFns).toContain('fspl');
    expect(userSyms).toEqual(expect.arrayContaining(['Pt', 'dist', 'freq', 'Gsum']));
    // core builtins never appear as dependencies
    expect(userSyms).not.toContain('quantity');
    expect(pkgFns).not.toContain('quantity');
  });

  it('load_package attaches a package to a running session and clears errors', () => {
    const s = new KernelSession(load('rf-link-budget.pro.md'), ALL_PACKAGES.map((p) => p));
    // simulate a notebook that never declared rf: strip and rebuild
    const bare = load('rf-link-budget.pro.md');
    bare.meta.packages = [];
    const s2 = new KernelSession(bare, ALL_PACKAGES);
    expect(s2.errors.get('rf-compute')?.kind).toBe('undefined_symbol');
    const reply = s2.request({ op: 'load_package', name: 'rf' });
    expect(reply.op).toBe('ok');
    expect(s2.errors.get('rf-compute')).toBeUndefined();
    expect(s2.notebook.meta.packages.map((p) => p.name)).toContain('rf');
    expect(s.capabilities).toContain('pkg.rf');
  });
});
