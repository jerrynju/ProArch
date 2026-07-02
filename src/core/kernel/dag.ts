// DAG construction per Cell data model spec §3 (Pluto-style rules):
// R1 one definer per symbol, R2 edges definer→referencer, R3 no cycles,
// R4 only top-level bindings enter the global symbol table.

import type { Cell, Ulid } from '../model/types';
import type { DagSnapshot, EvalError } from './protocol';

export interface CellAnalysis {
  defines: Set<string>;
  references: Set<string>;
  syntaxError?: EvalError;
}

export interface Dag {
  snapshot: DagSnapshot;
  /** cellId → direct downstream cellIds */
  downstream: Map<Ulid, Set<Ulid>>;
  /** cells excluded from evaluation with the blocking error */
  broken: Map<Ulid, EvalError>;
  definerOf: Map<string, Ulid>;
}

export function buildDag(cells: Cell[], analyses: Map<Ulid, CellAnalysis>, builtinNames: Set<string>): Dag {
  const broken = new Map<Ulid, EvalError>();
  const structuralErrors: { cellId: Ulid; error: EvalError }[] = [];

  // R1: multiple definitions
  const definers = new Map<string, Ulid[]>();
  for (const cell of cells) {
    const a = analyses.get(cell.id);
    if (!a) continue;
    if (a.syntaxError) {
      broken.set(cell.id, a.syntaxError);
      continue;
    }
    for (const sym of a.defines) {
      const list = definers.get(sym) ?? [];
      list.push(cell.id);
      definers.set(sym, list);
    }
  }
  const definerOf = new Map<string, Ulid>();
  for (const [sym, ids] of definers) {
    if (ids.length > 1) {
      for (const id of ids) {
        const err: EvalError = {
          kind: 'multiple_definition',
          message: `符号 ${sym} 被多个单元定义`,
          related: ids.filter((x) => x !== id),
        };
        broken.set(id, err);
        structuralErrors.push({ cellId: id, error: err });
      }
    } else {
      definerOf.set(sym, ids[0]);
    }
  }

  // R2: edges
  const edges: [Ulid, Ulid][] = [];
  const downstream = new Map<Ulid, Set<Ulid>>();
  const upstreamCount = new Map<Ulid, number>();
  const evalCells = cells.filter((c) => analyses.has(c.id) && !broken.has(c.id));
  for (const c of evalCells) upstreamCount.set(c.id, 0);
  for (const cell of evalCells) {
    const a = analyses.get(cell.id)!;
    for (const ref of a.references) {
      if (builtinNames.has(ref)) continue;
      const from = definerOf.get(ref);
      if (from && from !== cell.id && !broken.has(from)) {
        if (!downstream.get(from)?.has(cell.id)) {
          edges.push([from, cell.id]);
          if (!downstream.has(from)) downstream.set(from, new Set());
          downstream.get(from)!.add(cell.id);
          upstreamCount.set(cell.id, (upstreamCount.get(cell.id) ?? 0) + 1);
        }
      }
    }
  }

  // R3: cycle detection via Kahn topological sort
  const order: Ulid[] = [];
  const queue = evalCells.filter((c) => (upstreamCount.get(c.id) ?? 0) === 0).map((c) => c.id);
  const remaining = new Map(upstreamCount);
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const dn of downstream.get(id) ?? []) {
      const n = (remaining.get(dn) ?? 0) - 1;
      remaining.set(dn, n);
      if (n === 0) queue.push(dn);
    }
  }
  if (order.length < evalCells.length) {
    const inCycle = evalCells.map((c) => c.id).filter((id) => !order.includes(id));
    for (const id of inCycle) {
      const err: EvalError = {
        kind: 'circular',
        message: '存在循环依赖',
        related: inCycle.filter((x) => x !== id),
      };
      broken.set(id, err);
      structuralErrors.push({ cellId: id, error: err });
    }
  }

  return {
    snapshot: { edges, structuralErrors, order },
    downstream,
    broken,
    definerOf,
  };
}

/** Transitive downstream closure including the roots themselves. */
export function invalidationSet(dag: Dag, roots: Ulid[]): Set<Ulid> {
  const out = new Set<Ulid>();
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const dn of dag.downstream.get(id) ?? []) stack.push(dn);
  }
  return out;
}
