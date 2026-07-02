// Derives view-agnostic render cards from the notebook + kernel state.
// Feed / Read / Calc are all projections of this one card list (heuristics
// per Cell data model spec §2.2: hints override, defaults always work).

import type { Cell, Ulid } from '../core/model/types';
import { fmtNumber, KernelSession } from '../core/kernel/kernel';
import type { EvalError, MimeBundle } from '../core/kernel/protocol';
import type { PlotSpec } from '../core/kernel/lang';

export interface RenderCard {
  key: string;
  kind: 'section' | 'note' | 'compute' | 'plot' | 'check' | 'error' | 'placeholder';
  cell?: Cell;
  paramCells: Cell[];
  title: string;
  overviewLabel: string;
  summary: string;
  bundle?: MimeBundle;
  error?: EvalError;
  plot?: PlotSpec;
  check?: { pass: boolean; message: string };
  quantity?: { value: number; unit: string };
  aside?: { label: string; value: string };
  state: string; // ok | running | errored | blocked | placeholder
}

function stripHeading(md: string): { heading: string | null; body: string } {
  const lines = md.split('\n');
  if (/^#{1,6}\s/.test(lines[0] ?? '')) {
    return { heading: lines[0].replace(/^#+\s*/, ''), body: lines.slice(1).join('\n').trim() };
  }
  return { heading: null, body: md.trim() };
}

export function paramDisplayShort(cell: Cell): string {
  if (cell.kind.type !== 'param') return '';
  const k = cell.kind;
  if (k.control.kind === 'select') {
    const opt = k.control.options.find((o) => JSON.stringify(o.value) === JSON.stringify(k.value));
    return opt?.label ?? String(k.value);
  }
  const unit = 'unit' in k.control ? k.control.unit ?? '' : '';
  return `${typeof k.value === 'number' ? fmtNumber(k.value) : String(k.value)}${unit}`;
}

function paramsSummary(params: Cell[]): string {
  return params
    .filter((p) => p.kind.type === 'param' && p.kind.control.kind === 'slider')
    .map((p) => p.kind.type === 'param' ? `${p.kind.name}=${paramDisplayShort(p)}` : '')
    .join(', ');
}

function plotSummary(plot: PlotSpec): string {
  const maxAbs = plot.y.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
  const m = /^(.*?)\s*\((.+)\)\s*$/.exec(plot.yLabel ?? '');
  if (m) return `峰值${m[1]} = ${fmtNumber(maxAbs)} ${m[2]}`;
  return `峰值 ${fmtNumber(maxAbs)}`;
}

export function deriveCards(session: KernelSession): RenderCard[] {
  const cards: RenderCard[] = [];
  const nb = session.notebook;
  const usedParams = new Set<Ulid>();

  // group param cells by calc.group
  const groups = new Map<string, Cell[]>();
  for (const c of nb.cells) {
    if (c.kind.type === 'param') {
      const g = c.viewHints.calc?.group;
      if (g) {
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push(c);
        usedParams.add(c.id);
      }
    }
  }

  let sawSection = false;
  for (const cell of nb.cells) {
    const hints = cell.viewHints.calc ?? {};
    const k = cell.kind;

    if (k.type === 'markdown') {
      const { heading, body } = stripHeading(k.source);
      if (heading && !sawSection) {
        sawSection = true;
        cards.push({
          key: cell.id + ':section', kind: 'section', cell, paramCells: [],
          title: heading, overviewLabel: '标题',
          summary: nb.meta.subtitle ?? '', state: 'ok',
        });
        if (body) {
          cards.push({
            key: cell.id + ':note', kind: 'note', cell, paramCells: [],
            title: '说明', overviewLabel: '说明', summary: body, state: 'ok',
          });
        }
      } else {
        cards.push({
          key: cell.id, kind: 'note', cell, paramCells: [],
          title: '备注', overviewLabel: '备注', summary: k.source, state: 'ok',
        });
      }
      continue;
    }

    if (k.type === 'param') {
      if (usedParams.has(cell.id)) continue; // rendered inside its group card
      continue;
    }

    if (k.type === 'unknown') {
      if (hints.placeholder) {
        cards.push({
          key: cell.id, kind: 'placeholder', cell, paramCells: [],
          title: hints.title ?? '未支持的单元', overviewLabel: hints.title ?? '占位',
          summary: k.raw.trim(), state: 'placeholder',
        });
      }
      continue;
    }

    if (k.type === 'code') {
      const state = session.cellStates.get(cell.id);
      const error = session.errors.get(cell.id);
      const bundle = session.outputs.get(cell.id);
      const plot = bundle?.['application/vnd.proarch.plot+json'];
      const check = bundle?.['application/vnd.proarch.check+json'];
      const quantity = bundle?.['application/vnd.proarch.quantity+json'];
      const title = hints.title ?? k.title ?? '计算';
      const groupParams = hints.group ? groups.get(hints.group) ?? [] : [];

      const asideHint = hints.aside;
      let aside: RenderCard['aside'];
      if (asideHint) {
        const v = session.currentValue(asideHint.symbol);
        if (typeof v === 'number') aside = { label: asideHint.label, value: `${fmtNumber(v)} ${asideHint.unit ?? ''}`.trim() };
      }

      const stateTag = error ? 'errored' : state?.s === 'blocked' ? 'blocked' : state?.s ?? 'ok';

      if (error || state?.s === 'blocked') {
        cards.push({
          key: cell.id, kind: 'error', cell, paramCells: groupParams,
          title, overviewLabel: title, error,
          summary: error ? `错误 · ${error.message}` : '上游错误,未执行',
          state: stateTag,
        });
        continue;
      }
      if (plot) {
        cards.push({
          key: cell.id, kind: 'plot', cell, paramCells: groupParams, bundle, plot,
          title, overviewLabel: '曲线', summary: plotSummary(plot), state: stateTag,
        });
        continue;
      }
      if (check) {
        cards.push({
          key: cell.id, kind: 'check', cell, paramCells: groupParams, bundle, check,
          title, overviewLabel: '校核', summary: check.message, state: stateTag,
        });
        continue;
      }
      const ps = paramsSummary(groupParams);
      cards.push({
        key: cell.id, kind: 'compute', cell, paramCells: groupParams, bundle, quantity, aside,
        title, overviewLabel: '结果',
        summary: quantity ? `${ps ? ps + ' → ' : ''}${fmtNumber(quantity.value)}${quantity.unit}` : bundle?.['text/plain'] ?? '',
        state: stateTag,
      });
    }
  }
  return cards;
}
