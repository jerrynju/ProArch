import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseProMd } from '../src/core/promd/parse';
import { KernelSession, dedupeSymbols, makeCell } from '../src/core/kernel/kernel';
import { ALL_PACKAGES } from '../src/core/packages/rf';

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

  it('material cell derives section modulus from I and passes cleanly by default', () => {
    const s = new KernelSession(load('cantilever-beam.pro.md'));
    expect(s.errors.get('beam-material')).toBeUndefined();
    const check = s.outputs.get('beam-material')?.['application/vnd.proarch.check+json'];
    expect(check?.pass).toBe(true);
  });

  it('reintroducing the classic undefined I_section bug still errors with a hint', () => {
    const s = new KernelSession(load('cantilever-beam.pro.md'));
    s.request({
      op: 'update_cell', cellId: 'beam-material',
      source: 'let sigma = F * 1000.0 * L / (I_section * 1e-6);\ncheck(sigma <= 235e6, "应力满足限值", "应力超限")',
    });
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

  it('inserting the same compute template twice renames the second copy\'s symbol', () => {
    const s = new KernelSession(load('cantilever-beam.pro.md'));
    const template = 'let sigma_new = F * 1000.0 * L / ((I / 12.5) * 1e-6);\ncheck(sigma_new <= 235e6, "应力满足限值", "应力超限")';
    // first insertion: no collision yet, symbol name passes through untouched
    const first = dedupeSymbols(template, s.definedSymbols());
    expect(first).toContain('let sigma_new =');
    s.request({ op: 'insert_cell', after: 'beam-material', cell: makeCell({ type: 'code', source: first, lang: 'rhai' }) });
    // second insertion of the identical template now collides with the first
    const second = dedupeSymbols(template, s.definedSymbols());
    expect(second).toContain('let sigma_new2 =');
    expect(second).toContain('check(sigma_new2 <=');
  });

  it('dedupeSymbols renames a colliding let-binding and every reference to it', () => {
    const taken = new Set(['sigma', 'W_m3']);
    const out = dedupeSymbols('let sigma = 1.0;\ncheck(sigma <= 2.0, "ok", "no")', taken);
    expect(out).not.toMatch(/\bsigma\b/);
    expect(out).toContain('let sigma2 = 1.0;');
    expect(out).toContain('check(sigma2 <= 2.0');
  });

  it('dedupeSymbols leaves non-colliding bindings untouched', () => {
    const out = dedupeSymbols('let q = 1.0;\nquantity(q, "W")', new Set(['sigma']));
    expect(out).toBe('let q = 1.0;\nquantity(q, "W")');
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
});
