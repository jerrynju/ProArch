import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseProMd } from '../src/core/promd/parse';
import { KernelSession } from '../src/core/kernel/kernel';
import { AgentOrchestrator } from '../src/core/agent/orchestrator';
import type { AgentEvent } from '../src/core/kernel/protocol';

const load = () =>
  parseProMd(readFileSync(new URL('../notebooks/cantilever-beam.pro.md', import.meta.url), 'utf8')).notebook;

function runTurn(agent: AgentOrchestrator, text: string, mode: 'chat' | 'auto') {
  return new Promise<AgentEvent[]>((resolve) => {
    const events: AgentEvent[] = [];
    const unsub = agent.subscribe((e) => {
      events.push(e);
      if (e.kind.k === 'done') {
        unsub();
        resolve(events);
      }
    });
    agent.prompt({ text, mode });
  });
}

describe('scripted agent turns', () => {
  it('fix-error turn proposes a pending update that clears the error on accept', async () => {
    const session = new KernelSession(load());
    // the default notebook loads clean; reintroduce the classic undefined-I_section
    // bug (same bait orchestrator.fixErrorTurn pattern-matches) to exercise the flow
    session.request({
      op: 'update_cell', cellId: 'beam-material',
      source: 'let sigma = F * 1000.0 * L / (I_section * 1e-6);\ncheck(sigma <= 235e6, "应力满足 Q235 限值", "应力超限,建议增大截面")',
    });
    const agent = new AgentOrchestrator(session);
    expect(session.errors.get('beam-material')?.kind).toBe('undefined_symbol');

    const events = await runTurn(agent, '修复该错误', 'chat');
    const pending = events.find((e) => e.kind.k === 'pending_ready');
    expect(pending).toBeDefined();
    expect(session.pending?.ops[0].t).toBe('update');
    // shadow evaluation already shows the fix passing
    expect(session.pending!.shadowErrors.get('beam-material')).toBeUndefined();

    session.resolvePending({ d: 'accept_all' });
    expect(session.pending).toBeNull();
    expect(session.errors.get('beam-material')).toBeUndefined();
    const check = session.outputs.get('beam-material')?.['application/vnd.proarch.check+json'];
    expect(check?.pass).toBe(true);
  });

  it('reject_all leaves the notebook untouched', async () => {
    const session = new KernelSession(load());
    const agent = new AgentOrchestrator(session);
    await runTurn(agent, '', 'auto');
    const before = session.cellById('beam-params-F')!;
    expect(session.pending).not.toBeNull();
    session.resolvePending({ d: 'reject_all' });
    expect(before.kind.type === 'param' && before.kind.value).toBe(10);
  });

  it('auto-execute proposes a param bump; undo_turn reverts it', async () => {
    const session = new KernelSession(load());
    const agent = new AgentOrchestrator(session);
    const events = await runTurn(agent, '', 'auto');
    const turnId = events[0].turnId;
    session.resolvePending({ d: 'accept_all' });
    const f = session.cellById('beam-params-F')!;
    expect(f.kind.type === 'param' && f.kind.value).toBe(14);

    session.undoTurn(turnId);
    expect(f.kind.type === 'param' && f.kind.value).toBe(10);
  });

  it('verify turn answers from live kernel outputs', async () => {
    const session = new KernelSession(load());
    const agent = new AgentOrchestrator(session);
    const events = await runTurn(agent, '当前参数是否满足规范要求?', 'chat');
    const text = events.filter((e) => e.kind.k === 'delta').map((e) => (e.kind as { text: string }).text).join('');
    // verifyTurn reports the notebook's last check cell — with the default
    // notebook now loading clean, that's beam-material (材料应力校核)
    expect(text).toContain('满足');
    expect(text).toContain('mm');
  });
});
