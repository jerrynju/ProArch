// Reactive kernel session (spec: Kernel protocol v0.1 + Agent spec pending
// layer / op journal). In-process and synchronous, but every state change
// flows through Request → events exactly as the wire protocol defines, so a
// remote kernel can replace this class without touching the UI.

import type { Cell, Notebook, ParamValue, Ulid } from '../model/types';
import { paramValueToNumber } from '../model/types';
import { ulid } from '../model/ulid';
import { CORE_BUILTINS } from './builtins';
import { buildDag, invalidationSet, type CellAnalysis, type Dag } from './dag';
import {
  analyzeProgram, evalProgram, parse, LangError,
  type Env, type NativeFn, type Value,
} from './lang';
import type {
  CellOp, CellState, EvalError, Event, JournalEntry, MimeBundle, Origin, Reply, Request,
} from './protocol';

export interface DomainPackage {
  name: string;
  version: string;
  functions: Map<string, NativeFn>;
  /** one-line docs per exported symbol, for Inspect */
  docs: Record<string, string>;
}

export function fmtNumber(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (v !== 0 && (Math.abs(v) >= 1e6 || Math.abs(v) < 1e-3)) return v.toExponential(3);
  const r = Math.round(v * 100) / 100;
  return String(r);
}

export function fmtParamValue(v: ParamValue): string {
  if (typeof v === 'object' && v !== null) return `${fmtNumber(v.value)} ${v.unit}`;
  if (typeof v === 'number') return fmtNumber(v);
  return String(v);
}

function textPlain(v: Value | undefined): string {
  if (v === undefined) return '';
  if (typeof v === 'number') return fmtNumber(v);
  if (typeof v === 'boolean' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return `[数组 · ${v.length} 项]`;
  switch (v.kind) {
    case 'plot': return `图表 (${v.x.length} 点)`;
    case 'check': return v.message;
    case 'quantity': return `${fmtNumber(v.value)} ${v.unit}`;
    case 'closure': return '<闭包>';
    case 'native': return `<函数 ${v.name}>`;
  }
}

function toBundle(v: Value | undefined): MimeBundle {
  const bundle: MimeBundle = { 'text/plain': textPlain(v) };
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (v.kind === 'plot') bundle['application/vnd.proarch.plot+json'] = v;
    if (v.kind === 'check') bundle['application/vnd.proarch.check+json'] = v;
    if (v.kind === 'quantity') bundle['application/vnd.proarch.quantity+json'] = { value: v.value, unit: v.unit };
  }
  return bundle;
}

function langErrorToEval(e: unknown): EvalError {
  if (e instanceof LangError) {
    return { kind: e.kind, message: e.message, span: e.span, hint: e.hint, related: [] };
  }
  return { kind: 'panic', message: (e as Error)?.message ?? String(e), related: [] };
}

interface PendingLayer {
  turnId: Ulid;
  ops: CellOp[];
  shadowGeneration: number;
  shadowOutputs: Map<Ulid, MimeBundle>;
  shadowErrors: Map<Ulid, EvalError>;
}

export class KernelSession {
  notebook: Notebook;
  cellStates = new Map<Ulid, CellState>();
  outputs = new Map<Ulid, MimeBundle>();
  errors = new Map<Ulid, EvalError>();
  journal: JournalEntry[] = [];
  pending: PendingLayer | null = null;

  private analyses = new Map<Ulid, CellAnalysis>();
  private dag!: Dag;
  private symbols = new Map<string, Value>();
  private generation = 0;
  private seq = 0;
  private listeners = new Set<(e: Event) => void>();
  private builtins: Map<string, NativeFn>;
  private packageDocs: Record<string, string> = {};
  private packages: DomainPackage[];

  constructor(notebook: Notebook, packages: DomainPackage[] = []) {
    this.notebook = notebook;
    this.packages = packages;
    this.builtins = new Map(CORE_BUILTINS);
    for (const req of notebook.meta.packages) {
      const pkg = packages.find((p) => p.name === req.name);
      if (pkg) {
        for (const [name, fn] of pkg.functions) this.builtins.set(name, fn);
        Object.assign(this.packageDocs, pkg.docs);
      }
    }
    this.rebuild();
    this.recompute('all');
  }

  get capabilities(): string[] {
    const caps = ['agent', 'pending', 'journal'];
    for (const p of this.notebook.meta.packages) caps.push(`pkg.${p.name}`);
    return caps;
  }

  subscribe(fn: (e: Event) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: Event) {
    for (const fn of this.listeners) fn(e);
  }

  currentValue(symbol: string): Value | undefined {
    return this.symbols.get(symbol);
  }

  // ---------- control channel ----------

  request(req: Request, origin: Origin = { by: 'user' }): Reply {
    switch (req.op) {
      case 'update_cell': {
        const cell = this.cellById(req.cellId);
        if (!cell || cell.kind.type !== 'code') return { op: 'err', error: { kind: 'not_found', message: '单元不存在或不是代码单元' } };
        this.applyOps([{ t: 'update', cellId: req.cellId, source: req.source }], origin);
        return { op: 'ok' };
      }
      case 'insert_cell':
        this.applyOps([{ t: 'insert', after: req.after, cell: req.cell }], origin);
        return { op: 'ok' };
      case 'delete_cell':
        this.applyOps([{ t: 'delete', cellId: req.cellId }], origin);
        return { op: 'ok' };
      case 'set_param': {
        const cell = this.cellById(req.cellId);
        if (!cell || cell.kind.type !== 'param') return { op: 'err', error: { kind: 'not_found', message: '参数单元不存在' } };
        this.applyOps([{ t: 'set_param', cellId: req.cellId, value: req.value }], origin);
        return { op: 'ok' };
      }
      case 'execute_cell':
        this.recompute([req.cellId]);
        return { op: 'ok' };
      case 'interrupt':
        return { op: 'ok' }; // synchronous evaluation: nothing in flight
      case 'reset_kernel':
        this.symbols.clear();
        this.recompute('all');
        return { op: 'ok' };
      case 'inspect': {
        const doc = this.packageDocs[req.symbol];
        const val = this.symbols.get(req.symbol);
        const parts: string[] = [`**${req.symbol}**`];
        if (doc) parts.push(doc);
        if (val !== undefined) parts.push(`当前值:\`${textPlain(val)}\``);
        if (!doc && val === undefined && this.builtins.has(req.symbol)) parts.push('内置函数');
        if (parts.length === 1) parts.push('未找到该符号');
        return { op: 'inspection', markdown: parts.join('\n\n') };
      }
    }
  }

  cellById(id: Ulid): Cell | undefined {
    return this.notebook.cells.find((c) => c.id === id);
  }

  /** symbol name defined by a param/data cell, or code analysis defines */
  definesOf(id: Ulid): string[] {
    return [...(this.analyses.get(id)?.defines ?? [])];
  }

  paramDisplay(cell: Cell): string {
    if (cell.kind.type !== 'param') return '';
    const unit = 'unit' in cell.kind.control ? cell.kind.control.unit : undefined;
    const v = cell.kind.value;
    if (typeof v === 'number' && unit) return `${fmtNumber(v)} ${unit}`;
    return fmtParamValue(v);
  }

  // ---------- structural ops + journal ----------

  applyOps(ops: CellOp[], origin: Origin) {
    const roots: Ulid[] = [];
    let structureChanged = false;
    for (const op of ops) {
      const inverse = this.invert(op);
      if (!inverse) continue; // op targeted a missing cell — skip
      this.journal.push({ seq: this.seq++, origin, op, inverse, ts: Date.now() });
      switch (op.t) {
        case 'update': {
          const cell = this.cellById(op.cellId)!;
          if (cell.kind.type === 'code') cell.kind.source = op.source;
          structureChanged = true;
          roots.push(op.cellId);
          break;
        }
        case 'set_param': {
          const cell = this.cellById(op.cellId)!;
          if (cell.kind.type === 'param') cell.kind.value = op.value;
          roots.push(op.cellId);
          break;
        }
        case 'insert': {
          const idx = op.after ? this.notebook.cells.findIndex((c) => c.id === op.after) + 1 : 0;
          this.notebook.cells.splice(idx, 0, op.cell);
          structureChanged = true;
          roots.push(op.cell.id);
          break;
        }
        case 'delete': {
          const idx = this.notebook.cells.findIndex((c) => c.id === op.cellId);
          if (idx >= 0) {
            const downstream = invalidationSet(this.dag, [op.cellId]);
            downstream.delete(op.cellId);
            roots.push(...downstream);
            this.notebook.cells.splice(idx, 1);
            this.outputs.delete(op.cellId);
            this.errors.delete(op.cellId);
            this.cellStates.delete(op.cellId);
          }
          structureChanged = true;
          break;
        }
      }
    }
    this.notebook.meta.extra['modified'] = new Date().toISOString();
    this.emit({ ev: 'cells_changed', origin, ops, pending: false });
    if (structureChanged) this.rebuild();
    this.recompute(structureChanged ? 'all' : roots);
  }

  private invert(op: CellOp): CellOp | null {
    switch (op.t) {
      case 'update': {
        const cell = this.cellById(op.cellId);
        if (!cell || cell.kind.type !== 'code') return null;
        return { t: 'update', cellId: op.cellId, source: cell.kind.source };
      }
      case 'set_param': {
        const cell = this.cellById(op.cellId);
        if (!cell || cell.kind.type !== 'param') return null;
        return { t: 'set_param', cellId: op.cellId, value: cell.kind.value };
      }
      case 'insert':
        return { t: 'delete', cellId: op.cell.id };
      case 'delete': {
        const idx = this.notebook.cells.findIndex((c) => c.id === op.cellId);
        if (idx < 0) return null;
        return {
          t: 'insert',
          after: idx > 0 ? this.notebook.cells[idx - 1].id : null,
          cell: this.notebook.cells[idx],
        };
      }
    }
  }

  /** Undo every op of an agent turn, newest first (spec B6). */
  undoTurn(turnId: Ulid) {
    const entries = this.journal.filter((j) => j.origin.by === 'agent' && j.origin.turnId === turnId);
    const inverses = entries.reverse().map((j) => j.inverse);
    if (inverses.length > 0) this.applyOps(inverses, { by: 'system' });
  }

  // ---------- pending overlay (spec B5) ----------

  proposePending(turnId: Ulid, ops: CellOp[]): { shadowGeneration: number } {
    // Shadow evaluation: clone the notebook, apply ops, evaluate in isolation.
    const clone: Notebook = JSON.parse(JSON.stringify(this.notebook));
    const shadow = new KernelSession(clone, this.packages);
    for (const op of ops) shadow.applyOps([op], { by: 'agent', turnId });

    const shadowGeneration = ++this.generation;
    this.pending = {
      turnId,
      ops,
      shadowGeneration,
      shadowOutputs: shadow.outputs,
      shadowErrors: shadow.errors,
    };
    this.emit({ ev: 'cells_changed', origin: { by: 'agent', turnId }, ops, pending: true });
    return { shadowGeneration };
  }

  resolvePending(decision: { d: 'accept_all' } | { d: 'reject_all' } | { d: 'partial'; accept: number[] }) {
    if (!this.pending) return;
    const { turnId, ops } = this.pending;
    this.pending = null;
    if (decision.d === 'reject_all') {
      this.emit({ ev: 'cells_changed', origin: { by: 'agent', turnId }, ops: [], pending: false });
      return;
    }
    const chosen = decision.d === 'accept_all' ? ops : ops.filter((_, i) => decision.accept.includes(i));
    this.applyOps(chosen, { by: 'agent', turnId });
  }

  // ---------- analysis + evaluation ----------

  private rebuild() {
    this.analyses = new Map();
    for (const cell of this.notebook.cells) {
      const k = cell.kind;
      if (k.type === 'code') {
        try {
          const a = analyzeProgram(parse(k.source));
          this.analyses.set(cell.id, { defines: a.defines, references: a.references });
        } catch (e) {
          this.analyses.set(cell.id, {
            defines: new Set(),
            references: new Set(),
            syntaxError: langErrorToEval(e),
          });
        }
      } else if (k.type === 'param' || k.type === 'data') {
        this.analyses.set(cell.id, { defines: new Set([k.name]), references: new Set() });
      }
    }
    this.dag = buildDag(this.notebook.cells, this.analyses, new Set(this.builtins.keys()));
    this.emit({ ev: 'dag_updated', snapshot: this.dag.snapshot });
  }

  private recompute(roots: Ulid[] | 'all') {
    const gen = ++this.generation;
    const invalid = roots === 'all'
      ? new Set(this.dag.snapshot.order)
      : invalidationSet(this.dag, roots.filter((r) => this.analyses.has(r)));

    // structurally broken cells surface their error every plan
    for (const [cellId, error] of this.dag.broken) {
      this.errors.set(cellId, error);
      this.cellStates.set(cellId, { s: 'errored' });
      this.emit({ ev: 'cell_error', generation: gen, cellId, error, shadow: false });
    }

    const planCells = this.dag.snapshot.order.filter((id) => invalid.has(id));
    if (planCells.length === 0) {
      return;
    }
    this.emit({ ev: 'status', state: 'busy' });
    this.emit({ ev: 'plan_started', generation: gen, cells: planCells, shadow: false });
    for (const id of planCells) this.cellStates.set(id, { s: 'queued' });

    // drop symbols the invalidated cells defined, so stale values can't leak
    for (const id of planCells) {
      for (const sym of this.analyses.get(id)?.defines ?? []) this.symbols.delete(sym);
    }

    const failed = new Set<Ulid>(); // errored or blocked in this plan
    for (const [id, state] of this.cellStates) {
      if (!invalid.has(id) && (state.s === 'errored' || state.s === 'blocked')) failed.add(id);
    }

    for (const cellId of planCells) {
      const cell = this.cellById(cellId)!;
      const a = this.analyses.get(cellId)!;

      // blocked if any upstream definer failed
      const blockedBy: Ulid[] = [];
      for (const ref of a.references) {
        const from = this.dag.definerOf.get(ref);
        if (from && failed.has(from)) blockedBy.push(from);
      }
      if (blockedBy.length > 0) {
        failed.add(cellId);
        this.cellStates.set(cellId, { s: 'blocked', by: blockedBy });
        this.errors.delete(cellId);
        this.emit({ ev: 'cell_status', generation: gen, cellId, state: { s: 'blocked', by: blockedBy }, shadow: false });
        continue;
      }

      this.cellStates.set(cellId, { s: 'running' });
      this.emit({ ev: 'cell_status', generation: gen, cellId, state: { s: 'running' }, shadow: false });
      const t0 = performance.now();
      try {
        const k = cell.kind;
        let display: Value | undefined;
        if (k.type === 'param') {
          this.symbols.set(k.name, paramValueToNumber(k.value));
        } else if (k.type === 'data') {
          this.symbols.set(k.name, k.payload.kind === 'inline_csv'
            ? k.payload.text.split(/[\s,]+/).map(Number).filter(Number.isFinite)
            : []);
        } else if (k.type === 'code') {
          const globals: Env = {
            vars: this.symbols as Map<string, Value>,
            parent: { vars: this.builtins as unknown as Map<string, Value> },
          };
          const { bindings, last } = evalProgram(parse(k.source), globals);
          for (const [name, v] of bindings) {
            if (a.defines.has(name)) this.symbols.set(name, v);
          }
          display = last;
        }
        const ms = Math.max(0, performance.now() - t0);
        this.errors.delete(cellId);
        const bundle = toBundle(display);
        this.outputs.set(cellId, bundle);
        this.emit({ ev: 'display_data', generation: gen, cellId, data: bundle, shadow: false });
        this.cellStates.set(cellId, { s: 'ok', ms });
        this.emit({ ev: 'cell_status', generation: gen, cellId, state: { s: 'ok', ms }, shadow: false });
      } catch (e) {
        failed.add(cellId);
        const error = langErrorToEval(e);
        this.errors.set(cellId, error);
        this.outputs.delete(cellId);
        this.cellStates.set(cellId, { s: 'errored' });
        this.emit({ ev: 'cell_error', generation: gen, cellId, error, shadow: false });
        this.emit({ ev: 'cell_status', generation: gen, cellId, state: { s: 'errored' }, shadow: false });
      }
    }
    this.emit({ ev: 'plan_finished', generation: gen, outcome: 'completed', shadow: false });
    this.emit({ ev: 'status', state: 'idle' });
  }
}

/** Convenience: build a fresh cell */
export function makeCell(kind: Cell['kind']): Cell {
  return { id: ulid(), kind, viewHints: {}, tags: [] };
}
