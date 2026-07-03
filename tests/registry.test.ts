import { describe, expect, it } from 'vitest';
import { applicableActions, BUILTIN_ACTIONS, mergedActions, type ActionContext } from '../src/core/actions/registry';

const baseCtx: ActionContext = {
  view: 'calc',
  cellKind: 'code',
  evalState: 'ok',
  outputMimes: [],
  capabilities: ['agent', 'pending', 'journal'],
  selection: 'single_cell',
};

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
