import { describe, expect, it } from 'vitest';
import { parseProMd } from '../src/core/promd/parse';
import { KernelSession } from '../src/core/kernel/kernel';

function session(cells: string) {
  const { notebook } = parseProMd(`---\npro: 1\ntitle: t\n---\n\n${cells}`);
  return new KernelSession(notebook);
}

describe('DAG rules', () => {
  it('R1: duplicate definitions error both cells', () => {
    const s = session([
      '```rhai {#a .cell}\nlet x = 1.0;\n```',
      '```rhai {#b .cell}\nlet x = 2.0;\n```',
    ].join('\n\n'));
    expect(s.errors.get('a')?.kind).toBe('multiple_definition');
    expect(s.errors.get('b')?.kind).toBe('multiple_definition');
    expect(s.errors.get('a')?.related).toEqual(['b']);
  });

  it('R2/R3: edges follow defines→references; cycles are rejected', () => {
    const s = session([
      '```rhai {#a .cell}\nlet x = y + 1.0;\n```',
      '```rhai {#b .cell}\nlet y = x + 1.0;\n```',
    ].join('\n\n'));
    expect(s.errors.get('a')?.kind).toBe('circular');
    expect(s.errors.get('b')?.kind).toBe('circular');
  });

  it('invalidation only recomputes downstream', () => {
    const s = session([
      '```param {#p name=F control=slider min=0 max=10 step=1}\n5\n```',
      '```rhai {#c1 .cell}\nlet a = F * 2.0;\n```',
      '```rhai {#c2 .cell}\nlet b = 42.0;\n```',
    ].join('\n\n'));
    const recomputed: string[] = [];
    s.subscribe((e) => {
      if (e.ev === 'plan_started') recomputed.push(...e.cells);
    });
    s.request({ op: 'set_param', cellId: 'p', value: 7 });
    expect(recomputed).toContain('p');
    expect(recomputed).toContain('c1');
    expect(recomputed).not.toContain('c2');
    expect(s.currentValue('a')).toBe(14);
  });

  it('errored upstream blocks downstream', () => {
    const s = session([
      '```rhai {#a .cell}\nlet x = undefined_thing;\n```',
      '```rhai {#b .cell}\nlet y = x + 1.0;\n```',
    ].join('\n\n'));
    expect(s.errors.get('a')?.kind).toBe('undefined_symbol');
    expect(s.cellStates.get('b')?.s).toBe('blocked');
  });
});
