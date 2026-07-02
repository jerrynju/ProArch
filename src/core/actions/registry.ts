// Action registry (spec Part A): declarative ActionDecls + restricted
// predicate filtering. The three views are projections of this one registry —
// no view-private action mechanism exists.

import type { Ulid, ViewMode } from '../model/types';

export type CellKindTag = 'markdown' | 'code' | 'param' | 'data' | 'unknown';
export type CellStateTag = 'ok' | 'errored' | 'stale' | 'running' | 'blocked';
export type ActionGroup = 'primary' | 'edit' | 'insert' | 'ai' | 'export' | 'danger';

export interface Applicability {
  views?: ViewMode[];
  cellKinds?: CellKindTag[];
  evalStates?: CellStateTag[];
  hasOutputMime?: string[]; // prefix match
  requiresCapability?: string[];
  selection?: 'single_cell' | 'multi_cell' | 'notebook';
}

export type Invocation =
  | { type: 'ui_local'; command: string; args?: Record<string, unknown> }
  | { type: 'protocol'; request: string } // request template name
  | { type: 'insert_snippet'; kind: CellKindTag; template: string }
  | { type: 'agent'; promptTemplate: string; scope: 'cell' | 'cell_with_upstream' | 'notebook'; mode: 'auto' | 'propose'; readOnly?: boolean };

export interface ActionDecl {
  id: string; // "cell.*" | "nb.*" | "view.*" | "agent.*" | "pkg.<name>.*"
  title: string;
  icon: string;
  when: Applicability;
  priority: number; // 0–100
  invoke: Invocation;
  group: ActionGroup;
}

export interface ActionContext {
  view: ViewMode;
  cellKind?: CellKindTag;
  evalState?: CellStateTag;
  outputMimes: string[];
  capabilities: string[];
  selection: 'single_cell' | 'multi_cell' | 'notebook';
  cellId?: Ulid;
}

/** All present fields AND together; lists within a field OR (spec A1.1). */
export function isApplicable(a: Applicability, ctx: ActionContext): boolean {
  if (a.views && !a.views.includes(ctx.view)) return false;
  if (a.cellKinds && (!ctx.cellKind || !a.cellKinds.includes(ctx.cellKind))) return false;
  if (a.evalStates && (!ctx.evalState || !a.evalStates.includes(ctx.evalState))) return false;
  if (a.hasOutputMime && !a.hasOutputMime.some((m) => ctx.outputMimes.some((o) => o.startsWith(m)))) return false;
  if (a.requiresCapability && !a.requiresCapability.every((c) => ctx.capabilities.includes(c))) return false;
  if (a.selection && a.selection !== ctx.selection) return false;
  return true;
}

export function applicableActions(registry: ActionDecl[], ctx: ActionContext): ActionDecl[] {
  return registry
    .filter((a) => isApplicable(a.when, ctx))
    .sort((x, y) => y.priority - x.priority || x.id.localeCompare(y.id));
}

/** Built-in action baseline (spec A4). Package actions merge in at session open. */
export const BUILTIN_ACTIONS: ActionDecl[] = [
  { id: 'cell.move_up', title: '上移', icon: 'arrow-up', when: { views: ['calc'], selection: 'single_cell' }, priority: 60, group: 'edit', invoke: { type: 'ui_local', command: 'move_up' } },
  { id: 'cell.move_down', title: '下移', icon: 'arrow-down', when: { views: ['calc'], selection: 'single_cell' }, priority: 59, group: 'edit', invoke: { type: 'ui_local', command: 'move_down' } },
  { id: 'cell.duplicate', title: '复制', icon: 'copy', when: { views: ['calc'], selection: 'single_cell' }, priority: 58, group: 'edit', invoke: { type: 'ui_local', command: 'duplicate' } },
  { id: 'cell.delete', title: '删除', icon: 'trash', when: { views: ['calc'], selection: 'single_cell' }, priority: 10, group: 'danger', invoke: { type: 'protocol', request: 'delete_cell' } },
  { id: 'cell.execute', title: '运行', icon: 'play', when: { views: ['calc'], cellKinds: ['code', 'param'] }, priority: 90, group: 'primary', invoke: { type: 'protocol', request: 'execute_cell' } },
  {
    id: 'cell.fix_error', title: '修复错误', icon: 'wrench',
    when: { evalStates: ['errored'], requiresCapability: ['agent'] }, priority: 95, group: 'ai',
    invoke: { type: 'agent', promptTemplate: '修复单元 {cell_id} 的错误', scope: 'cell_with_upstream', mode: 'propose' },
  },
  {
    id: 'cell.explain', title: '解释', icon: 'sparkle',
    when: { cellKinds: ['code'], requiresCapability: ['agent'] }, priority: 80, group: 'ai',
    invoke: { type: 'agent', promptTemplate: '解释这段计算', scope: 'cell', mode: 'auto', readOnly: true },
  },
  {
    id: 'cell.optimize', title: '优化', icon: 'gear',
    when: { cellKinds: ['code'], requiresCapability: ['agent'] }, priority: 70, group: 'ai',
    invoke: { type: 'agent', promptTemplate: '优化这段计算', scope: 'cell', mode: 'propose' },
  },
  {
    id: 'nb.generate_chart', title: '生成图表', icon: 'chart',
    when: { requiresCapability: ['agent'] }, priority: 65, group: 'ai',
    invoke: { type: 'agent', promptTemplate: '为当前结果生成图表', scope: 'notebook', mode: 'propose' },
  },
  {
    id: 'nb.ask', title: '提问', icon: 'send',
    when: { requiresCapability: ['agent'] }, priority: 60, group: 'ai',
    invoke: { type: 'agent', promptTemplate: '', scope: 'notebook', mode: 'auto', readOnly: true },
  },
  {
    id: 'insert.compute', title: '计算', icon: 'calc',
    when: { views: ['calc'] }, priority: 85, group: 'insert',
    invoke: { type: 'insert_snippet', kind: 'code', template: 'let 结果 = 0.0;\nquantity(结果, "")' },
  },
  {
    id: 'insert.plot', title: '绘图', icon: 'plot',
    when: { views: ['calc'] }, priority: 84, group: 'insert',
    invoke: { type: 'insert_snippet', kind: 'code', template: 'let xs = linspace(0.0, 10.0, 50);\nlet ys = map(xs, |x| x);\nplot(xs, ys)' },
  },
  {
    id: 'insert.note', title: '备注', icon: 'note',
    when: { views: ['calc'] }, priority: 83, group: 'insert',
    invoke: { type: 'insert_snippet', kind: 'markdown', template: '备注内容…' },
  },
  { id: 'data.export', title: '导出 CSV', icon: 'download', when: { hasOutputMime: ['application/vnd.proarch.plot'] }, priority: 50, group: 'export', invoke: { type: 'ui_local', command: 'export_csv' } },
];

/** rf package's contributed actions (spec A3 — packages may only register
 * insert_snippet / agent invocations, inside their pkg.<name>.* namespace). */
export const RF_PACKAGE_ACTIONS: ActionDecl[] = [
  {
    id: 'pkg.rf.link_budget', title: '链路预算模板', icon: 'antenna',
    when: { views: ['calc'], requiresCapability: ['pkg.rf'] }, priority: 82, group: 'insert',
    invoke: {
      type: 'insert_snippet', kind: 'code',
      template: 'let 损耗 = fspl(10.0 `km`, 9.4 `GHz`);\nlet 接收 = 30.0 - 损耗 + 35.0;\nquantity(接收, "dBm")',
    },
  },
];

export function mergedActions(capabilities: string[]): ActionDecl[] {
  const out = [...BUILTIN_ACTIONS];
  if (capabilities.includes('pkg.rf')) out.push(...RF_PACKAGE_ACTIONS);
  return out;
}
