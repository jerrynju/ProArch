// Agent orchestrator (spec Part B) — scripted v0.1.
// The turn lifecycle, tool-call whitelist shape, pending overlay and journal
// integration are the real machinery; only the "LLM" is a deterministic
// script over live kernel state. Swapping in a real model changes this file
// only — every mutation already flows through standard kernel requests.

import type { Ulid } from '../model/types';
import { ulid } from '../model/ulid';
import { fmtNumber, KernelSession, makeCell, dedupeSymbols } from '../kernel/kernel';
import type { AgentEvent, CellOp } from '../kernel/protocol';

export type AgentSendMode = 'chat' | 'auto';

export interface TurnRequest {
  text: string;
  mode: AgentSendMode;
  cellId?: Ulid; // selection context
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class AgentOrchestrator {
  private listeners = new Set<(e: AgentEvent) => void>();
  private aborted = new Set<Ulid>();

  constructor(private session: KernelSession) {}

  subscribe(fn: (e: AgentEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(turnId: Ulid, kind: AgentEvent['kind']) {
    for (const fn of this.listeners) fn({ turnId, kind });
  }

  abort(turnId: Ulid) {
    this.aborted.add(turnId);
  }

  prompt(req: TurnRequest): Ulid {
    const turnId = ulid();
    void this.run(turnId, req);
    return turnId;
  }

  private async stream(turnId: Ulid, text: string, chunk = 14) {
    for (let i = 0; i < text.length; i += chunk) {
      if (this.aborted.has(turnId)) return;
      this.emit(turnId, { k: 'delta', text: text.slice(i, i + chunk) });
      await sleep(24);
    }
  }

  // ---- live kernel readings the scripts answer from ----

  private latestCheck(): { pass: boolean; message: string } | null {
    for (const cell of [...this.session.notebook.cells].reverse()) {
      const out = this.session.outputs.get(cell.id);
      const check = out?.['application/vnd.proarch.check+json'];
      if (check) return check;
    }
    return null;
  }

  private latestQuantity(): { value: number; unit: string } | null {
    for (const cell of [...this.session.notebook.cells].reverse()) {
      const out = this.session.outputs.get(cell.id);
      const q = out?.['application/vnd.proarch.quantity+json'];
      if (q) return q;
    }
    return null;
  }

  private firstErroredCell(): { id: Ulid; message: string; hint?: string } | null {
    for (const cell of this.session.notebook.cells) {
      const err = this.session.errors.get(cell.id);
      if (err) return { id: cell.id, message: err.message, hint: err.hint };
    }
    return null;
  }

  private latestPlotCell(): { id: Ulid; source: string; title?: string } | null {
    for (const cell of [...this.session.notebook.cells].reverse()) {
      if (cell.kind.type !== 'code') continue;
      const out = this.session.outputs.get(cell.id);
      if (out?.['application/vnd.proarch.plot+json']) {
        return { id: cell.id, source: cell.kind.source, title: cell.kind.title };
      }
    }
    return null;
  }

  private async run(turnId: Ulid, req: TurnRequest) {
    try {
      const text = req.text.trim();
      if (req.mode === 'auto') {
        await this.autoExecuteTurn(turnId);
      } else if (/修复|fix/i.test(text)) {
        await this.fixErrorTurn(turnId);
      } else if (/校核|规范|verify|满足/.test(text)) {
        await this.verifyTurn(turnId);
      } else if (/解释|explain/.test(text)) {
        await this.explainTurn(turnId, req.cellId);
      } else if (/优化|optimize/i.test(text)) {
        await this.optimizeTurn(turnId);
      } else if (/生成图表|图表|chart/i.test(text)) {
        await this.plotTurn(turnId);
      } else {
        await this.genericTurn(turnId);
      }
      if (!this.aborted.has(turnId)) this.emit(turnId, { k: 'done', outcome: 'completed' });
      else this.emit(turnId, { k: 'done', outcome: 'aborted' });
    } catch (e) {
      this.emit(turnId, { k: 'done', outcome: { error: (e as Error).message } });
    }
  }

  /** Read-only turn: answer the verification question from live outputs. */
  private async verifyTurn(turnId: Ulid) {
    const callId = ulid();
    this.emit(turnId, { k: 'tool_call', callId, tool: 'read_output', summary: '读取校核单元输出' });
    await sleep(160);
    const check = this.latestCheck();
    const q = this.latestQuantity();
    this.emit(turnId, { k: 'tool_result', callId, ok: !!check, summary: check ? '已获取最新校核结果' : '未找到校核单元' });
    if (!check) {
      await this.stream(turnId, '当前笔记本没有校核单元。可以用 /verify 插入一个规范校核。');
      return;
    }
    const head = q ? `当前计算结果为 ${fmtNumber(q.value)} ${q.unit}。` : '';
    await this.stream(turnId, `${head}校核结论:${check.message}。${check.pass ? '所有指标在限值以内,无需调整。' : '建议减小荷载或增大截面刚度后重新校核。'}`);
  }

  private async explainTurn(turnId: Ulid, cellId?: Ulid) {
    const cell = cellId ? this.session.cellById(cellId) : undefined;
    const callId = ulid();
    this.emit(turnId, { k: 'tool_call', callId, tool: 'read_cell', summary: '读取单元源码' });
    await sleep(140);
    this.emit(turnId, { k: 'tool_result', callId, ok: true, summary: '已读取' });
    if (cell?.kind.type === 'code') {
      const defines = this.session.definesOf(cell.id).filter((d) => !d.startsWith('_'));
      await this.stream(
        turnId,
        `这个单元${cell.kind.title ? `(${cell.kind.title})` : ''}定义了 ${defines.map((d) => '`' + d + '`').join('、') || '计算结果'}。` +
          '它在依赖图中的上游参数变化时会自动重算;下游单元引用这些符号时会随之更新。',
      );
    } else {
      await this.stream(turnId, '请选中一个代码单元后再让我解释。');
    }
  }

  private async genericTurn(turnId: Ulid) {
    const q = this.latestQuantity();
    const check = this.latestCheck();
    await this.stream(
      turnId,
      `你好,我是本笔记本的分析助手。${q ? `当前关键结果:${fmtNumber(q.value)} ${q.unit}。` : ''}${check ? `校核状态:${check.message}。` : ''}` +
        '可以让我"修复错误"、"校核规范",或切到自主执行让我直接调整参数。',
    );
  }

  /** Propose turn: fix the first errored cell (demo: undefined I_section). */
  private async fixErrorTurn(turnId: Ulid) {
    const err = this.firstErroredCell();
    if (!err) {
      await this.stream(turnId, '当前没有处于错误状态的单元。');
      return;
    }
    await this.stream(turnId, `该错误因${err.message}导致。`);
    const c1 = ulid();
    this.emit(turnId, { k: 'tool_call', callId: c1, tool: 'inspect', summary: '查询相关符号定义' });
    await sleep(180);
    this.emit(turnId, { k: 'tool_result', callId: c1, ok: true, summary: '确认笔记本中未定义该符号' });

    const cell = this.session.cellById(err.id);
    if (!cell || cell.kind.type !== 'code' || !/I_section/.test(cell.kind.source)) {
      await this.stream(turnId, '这个错误需要人工处理:我没有足够信息推断正确的修复。');
      return;
    }
    // suffix the derived symbols with the cell id so the fix never collides
    // with another cell's own W/sigma definitions (DAG rule R1: at most one
    // definer per symbol notebook-wide)
    const suf = err.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6) || 'fix';
    const fixed = [
      '// 抗弯截面模量 W = I / c,矩形截面取 c = 12.5 cm',
      `let W_${suf} = (I / 12.5) * 1e-6;`,
      `let sigma_${suf} = F * 1000.0 * L / W_${suf};`,
      `check(sigma_${suf} <= 235e6, "应力满足 Q235 限值", "应力超限,建议增大截面")`,
    ].join('\n');

    const c2 = ulid();
    this.emit(turnId, { k: 'tool_call', callId: c2, tool: 'update_cell', summary: '用截面模量 W 重写应力校核' });
    const ops: CellOp[] = [{
      t: 'update', cellId: err.id, source: fixed,
      label: '材料应力校核', before: '引用未定义的 I_section', afterText: '由 I 推导 W 并校核 σ ≤ 235 MPa',
      reason: '修复未定义变量:改用截面惯性矩 I 推导截面模量',
    }];
    const { shadowGeneration } = this.session.proposePending(turnId, ops);
    this.emit(turnId, { k: 'tool_result', callId: c2, ok: true, summary: '修复已生成,等待确认' });
    await this.stream(turnId, '我用截面惯性矩 I 推导出截面模量 W 并重写了应力校核。请在待确认变更中查看修复后的结果。');
    this.emit(turnId, { k: 'pending_ready', ops, shadowGeneration });
  }

  /** Read-only turn: analyze the latest check and suggest which param to adjust. */
  private async optimizeTurn(turnId: Ulid) {
    const callId = ulid();
    this.emit(turnId, { k: 'tool_call', callId, tool: 'read_output', summary: '读取校核单元与参数范围' });
    await sleep(160);
    const check = this.latestCheck();
    this.emit(turnId, { k: 'tool_result', callId, ok: !!check, summary: check ? '已获取校核结果' : '未找到校核单元' });
    if (!check) {
      await this.stream(turnId, '当前笔记本没有校核单元,无法给出优化建议。');
      return;
    }
    if (check.pass) {
      await this.stream(turnId, `当前校核已通过(${check.message}),暂无需优化。如需更保守的余量,可以让我切到"自主执行"按活荷载组合放大参数后重新校核。`);
      return;
    }
    const paramCell = this.session.notebook.cells.find(
      (c) => c.kind.type === 'param' && c.kind.control.kind === 'slider',
    );
    if (!paramCell || paramCell.kind.type !== 'param') {
      await this.stream(turnId, `校核未通过(${check.message}),但笔记本中没有可调整的参数单元。`);
      return;
    }
    const label = paramCell.kind.label ?? paramCell.kind.name;
    await this.stream(
      turnId,
      `校核未通过(${check.message})。建议减小 ${label} 或增大截面刚度相关参数后重新校核;也可以让我切到"自主执行"直接尝试调整并预览结果。`,
    );
  }

  /** Propose turn: duplicate the notebook's existing plot cell as a starting chart. */
  private async plotTurn(turnId: Ulid) {
    const ref = this.latestPlotCell();
    if (!ref) {
      await this.stream(turnId, '当前笔记本没有可参考的曲线单元,无法自动生成图表。可以从"插入 → 绘图"手动选择模板。');
      return;
    }
    const c1 = ulid();
    this.emit(turnId, { k: 'tool_call', callId: c1, tool: 'read_cell', summary: '参考已有绘图单元' });
    await sleep(140);
    this.emit(turnId, { k: 'tool_result', callId: c1, ok: true, summary: '已读取' });

    // duplicating a cell verbatim would redefine its `let` bindings twice —
    // rename the copy's symbols so both cells coexist under DAG rule R1
    const source = dedupeSymbols(ref.source, this.session.definedSymbols());
    const cell = makeCell({ type: 'code', source, lang: 'rhai', title: `${ref.title ?? '曲线'} · 副本` });
    cell.viewHints = { calc: { title: cell.kind.type === 'code' ? cell.kind.title : undefined, icon: 'plot' } };

    const c2 = ulid();
    this.emit(turnId, { k: 'tool_call', callId: c2, tool: 'insert_cell', summary: '插入新的图表单元' });
    const ops: CellOp[] = [{ t: 'insert', after: ref.id, cell }];
    const { shadowGeneration } = this.session.proposePending(turnId, ops);
    this.emit(turnId, { k: 'tool_result', callId: c2, ok: true, summary: '图表已生成,等待确认' });
    await this.stream(turnId, `我基于笔记本现有参数补充了一张图表(${cell.kind.type === 'code' ? cell.kind.title : ''})。请在待确认变更中查看并接受。`);
    this.emit(turnId, { k: 'pending_ready', ops, shadowGeneration });
  }

  /** Autonomous-execution turn (design's 自主执行): propose a parameter change. */
  private async autoExecuteTurn(turnId: Ulid) {
    await this.stream(turnId, '进入自主执行:我将按活荷载组合调整荷载并重新校核。');
    const paramCell = this.session.notebook.cells.find(
      (c) => c.kind.type === 'param' && c.kind.control.kind === 'slider',
    );
    if (!paramCell || paramCell.kind.type !== 'param') {
      await this.stream(turnId, '没有可调整的参数单元。');
      return;
    }
    const control = paramCell.kind.control as { kind: 'slider'; min: number; max: number; step: number; unit?: string };
    const cur = typeof paramCell.kind.value === 'number' ? paramCell.kind.value : 0;
    const next = Math.min(control.max, Math.round(cur * 1.4 / control.step) * control.step);

    const c1 = ulid();
    this.emit(turnId, { k: 'tool_call', callId: c1, tool: 'set_param', summary: `调整 ${paramCell.kind.label ?? paramCell.kind.name} → ${next} ${control.unit ?? ''}` });
    const ops: CellOp[] = [{
      t: 'set_param', cellId: paramCell.id, value: next,
      label: paramCell.kind.label ?? paramCell.kind.name,
      before: `${fmtNumber(cur)} ${control.unit ?? ''}`,
      afterText: `${fmtNumber(next)} ${control.unit ?? ''}`,
      reason: 'Agent 建议按活荷载组合放大 40%',
    }];
    const { shadowGeneration } = this.session.proposePending(turnId, ops);
    this.emit(turnId, { k: 'tool_result', callId: c1, ok: true, summary: '影子求值完成' });
    await this.stream(turnId, '已在影子求值中预览调整后的结果。请在待确认变更中逐项确认或拒绝。');
    this.emit(turnId, { k: 'pending_ready', ops, shadowGeneration });
  }
}
