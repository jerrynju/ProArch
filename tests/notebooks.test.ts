// Every shipped example notebook must parse and evaluate cleanly: no cell
// errors, and all check cells pass at their default parameter values.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseProMd } from '../src/core/promd/parse';
import { KernelSession } from '../src/core/kernel/kernel';
import { ALL_PACKAGES } from '../src/core/packages';

const dir = fileURLToPath(new URL('../notebooks', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.pro.md'));

describe('shipped notebooks evaluate cleanly', () => {
  it('finds the full example set', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of files) {
    it(`${file}: no errors, all checks pass at defaults`, () => {
      const raw = readFileSync(`${dir}/${file}`, 'utf8');
      const { notebook, diagnostics } = parseProMd(raw);
      expect(diagnostics).toEqual([]);
      const s = new KernelSession(notebook, ALL_PACKAGES);
      for (const cell of notebook.cells) {
        if (cell.kind.type === 'unknown' || cell.kind.type === 'markdown') continue;
        expect(s.errors.get(cell.id), `${file} · ${cell.id}`).toBeUndefined();
      }
      for (const [cellId, bundle] of s.outputs) {
        const check = bundle['application/vnd.proarch.check+json'];
        if (check) expect(check.pass, `${file} · ${cellId}: ${check.message}`).toBe(true);
      }
    });
  }
});

describe('circuit domain package', () => {
  const load = (name: string) =>
    parseProMd(readFileSync(`${dir}/${name}`, 'utf8')).notebook;

  it('tau/settle golden values (R=10kΩ, C=1µF → τ=10ms)', () => {
    const s = new KernelSession(load('rc-transient.pro.md'), ALL_PACKAGES);
    expect(s.currentValue('tau_ms')).toBeCloseTo(10, 6);
    expect(s.currentValue('t_settle')).toBeCloseTo(30, 6);
    expect(s.currentValue('fc')).toBeCloseTo(15.915, 2);
    expect(s.capabilities).toContain('pkg.circuit');
  });

  it('functions are package-gated, not core builtins', () => {
    const noPkg = new KernelSession(load('rc-transient.pro.md'), []);
    expect(noPkg.errors.get('rc-compute')?.kind).toBe('undefined_symbol');
  });

  it('settle-time check fails once R is large', () => {
    const s = new KernelSession(load('rc-transient.pro.md'), ALL_PACKAGES);
    s.request({ op: 'set_param', cellId: 'rc-params-R', value: 50 }); // 3τ = 150ms > 50ms
    const check = s.outputs.get('rc-verify')?.['application/vnd.proarch.check+json'];
    expect(check?.pass).toBe(false);
  });
});
