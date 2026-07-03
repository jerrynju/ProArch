import { describe, expect, it } from 'vitest';
import { applicableActions, BUILTIN_ACTIONS, mergedActions, type ActionContext } from '../src/core/actions/registry';
import { PackageRegistry, satisfies } from '../src/core/packages/registry';
import { ALL_PACKAGES } from '../src/core/packages';
import type { DomainPackage } from '../src/core/kernel/kernel';
import type { NativeFn } from '../src/core/kernel/lang';

const baseCtx: ActionContext = {
  view: 'calc',
  cellKind: 'code',
  evalState: 'ok',
  outputMimes: [],
  capabilities: ['agent', 'pending', 'journal'],
  selection: 'single_cell',
};

function fakePkg(name: string, version: string, opts: Partial<DomainPackage> = {}): DomainPackage {
  return {
    name, version,
    requires: opts.requires ?? [],
    functions: opts.functions ?? new Map<string, NativeFn>([[`${name}_fn`, { kind: 'native', name: `${name}_fn`, fn: () => 0 }]]),
    constants: opts.constants,
    docs: {},
  };
}

describe('Action Registry applicability', () => {
  it('an ok-state cell does not surface fix_error, but does surface explain/optimize/ask', () => {
    const ai = applicableActions(BUILTIN_ACTIONS, baseCtx).filter((a) => a.group === 'ai');
    expect(ai.map((a) => a.id)).not.toContain('cell.fix_error');
    expect(ai.map((a) => a.id)).toEqual(expect.arrayContaining(['cell.explain', 'cell.optimize', 'nb.ask']));
  });

  it('an errored cell surfaces fix_error ahead of every other AI action', () => {
    const ctx: ActionContext = { ...baseCtx, evalState: 'errored' };
    const ai = applicableActions(BUILTIN_ACTIONS, ctx).filter((a) => a.group === 'ai');
    expect(ai[0].id).toBe('cell.fix_error');
  });

  it('without the agent capability, every AI action disappears (offline/no-key degrades gracefully)', () => {
    const ctx: ActionContext = { ...baseCtx, capabilities: [] };
    const ai = applicableActions(BUILTIN_ACTIONS, ctx).filter((a) => a.group === 'ai');
    expect(ai).toHaveLength(0);
  });

  it('pkg.rf action only appears once the rf capability is present', () => {
    const withoutRf = applicableActions(mergedActions(['agent']), { ...baseCtx, capabilities: ['agent'] });
    const withRf = applicableActions(mergedActions(['agent', 'pkg.rf']), { ...baseCtx, capabilities: ['agent', 'pkg.rf'] });
    expect(withoutRf.map((a) => a.id)).not.toContain('pkg.rf.link_budget');
    expect(withRf.map((a) => a.id)).toContain('pkg.rf.link_budget');
  });
});

describe('semver requirements', () => {
  it('handles *, exact, ^, ~, >=', () => {
    expect(satisfies('1.2.3', '*')).toBe(true);
    expect(satisfies('1.2.3', '1.2.3')).toBe(true);
    expect(satisfies('1.2.4', '1.2.3')).toBe(false);
    expect(satisfies('1.9.0', '^1.2')).toBe(true);
    expect(satisfies('2.0.0', '^1.2')).toBe(false);
    expect(satisfies('1.1.0', '^1.2')).toBe(false);
    expect(satisfies('1.2.9', '~1.2')).toBe(true);
    expect(satisfies('1.3.0', '~1.2')).toBe(false);
    expect(satisfies('2.1.0', '>=1.5')).toBe(true);
    expect(satisfies('1.4.9', '>=1.5')).toBe(false);
  });
});

describe('package registry', () => {
  it('resolves transitive dependencies deps-first (mech pulls units)', () => {
    const reg = new PackageRegistry();
    for (const p of ALL_PACKAGES) reg.register(p);
    const res = reg.resolve([{ name: 'mech', version: '^1.0' }]);
    expect(res.missing).toHaveLength(0);
    const names = res.order.map((p) => p.name);
    expect(names).toEqual(['units', 'mech']);
  });

  it('picks the highest version satisfying the requirement', () => {
    const reg = new PackageRegistry();
    reg.register(fakePkg('a', '1.0.0'));
    reg.register(fakePkg('a', '1.4.0'));
    reg.register(fakePkg('a', '2.0.0'));
    expect(reg.get('a', '^1.0')?.version).toBe('1.4.0');
    expect(reg.get('a', '*')?.version).toBe('2.0.0');
    expect(reg.get('a', '>=1.2')?.version).toBe('2.0.0');
  });

  it('reports unsatisfiable requirements as missing', () => {
    const reg = new PackageRegistry();
    reg.register(fakePkg('a', '1.0.0', { requires: [{ name: 'ghost', version: '^1.0' }] }));
    const res = reg.resolve([{ name: 'a', version: '^1.0' }]);
    expect(res.missing.map((m) => m.name)).toContain('ghost');
    expect(res.order.map((p) => p.name)).toContain('a');
  });

  it('detects dependency cycles without hanging', () => {
    const reg = new PackageRegistry();
    reg.register(fakePkg('x', '1.0.0', { requires: [{ name: 'y', version: '*' }] }));
    reg.register(fakePkg('y', '1.0.0', { requires: [{ name: 'x', version: '*' }] }));
    const res = reg.resolve([{ name: 'x', version: '*' }]);
    expect(res.cycles.length).toBeGreaterThan(0);
  });

  it('flags symbol conflicts between resolved packages', () => {
    const fns = new Map<string, NativeFn>([['dup', { kind: 'native', name: 'dup', fn: () => 1 }]]);
    const reg = new PackageRegistry();
    reg.register(fakePkg('p1', '1.0.0', { functions: fns }));
    reg.register(fakePkg('p2', '1.0.0', { functions: new Map(fns) }));
    const res = reg.resolve([{ name: 'p1', version: '*' }, { name: 'p2', version: '*' }]);
    expect(res.conflicts).toEqual([{ symbol: 'dup', packages: ['p1', 'p2'] }]);
  });

  it('whoProvides indexes functions and constants', () => {
    const reg = new PackageRegistry();
    for (const p of ALL_PACKAGES) reg.register(p);
    expect(reg.whoProvides('fspl').map((p) => p.name)).toEqual(['rf']);
    expect(reg.whoProvides('sigma_bend').map((p) => p.name)).toEqual(['mech']);
    expect(reg.whoProvides('E_steel').map((p) => p.name)).toEqual(['mech']);
    expect(reg.whoProvides('nonexistent')).toHaveLength(0);
  });
});
