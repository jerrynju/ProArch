// Kernel message protocol (spec v0.1), transport-agnostic. In-process today;
// the same shapes serialize over WebSocket later.

import type { Cell, ParamValue, Ulid } from '../model/types';
import type { PlotSpec, CheckResult } from './lang';

export type Origin =
  | { by: 'user' }
  | { by: 'agent'; turnId: Ulid }
  | { by: 'system' };

// ---- requests / replies (control channel) ----

export type Request =
  | { op: 'update_cell'; cellId: Ulid; source: string }
  | { op: 'insert_cell'; after: Ulid | null; cell: Cell }
  | { op: 'delete_cell'; cellId: Ulid }
  | { op: 'execute_cell'; cellId: Ulid }
  | { op: 'set_param'; cellId: Ulid; value: ParamValue }
  | { op: 'interrupt'; generation?: number }
  | { op: 'inspect'; symbol: string }
  | { op: 'reset_kernel' }
  | { op: 'load_package'; name: string }
  /** self-evolution: lift a closure defined in a cell into the workspace's
   * learned package, making it ambient in every session */
  | { op: 'promote_function'; cellId: Ulid; symbol: string };

export type Reply =
  | { op: 'ok' }
  | { op: 'inspection'; markdown: string }
  | { op: 'err'; error: KernelError };

export interface KernelError { kind: string; message: string }

// ---- events (iopub channel) ----

export type KernelState = 'idle' | 'busy' | 'resetting';

export type CellState =
  | { s: 'stale' }
  | { s: 'queued' }
  | { s: 'running' }
  | { s: 'ok'; ms: number }
  | { s: 'errored' }
  | { s: 'cancelled' }
  | { s: 'blocked'; by: Ulid[] };

export interface EvalError {
  kind: 'syntax' | 'undefined_symbol' | 'type' | 'dimension' | 'runtime' | 'panic' | 'multiple_definition' | 'circular';
  message: string;
  span?: { start: number; end: number };
  hint?: string;
  /** offending symbol for undefined_symbol — drives capability-gap suggestions */
  symbol?: string;
  related: Ulid[];
}

export interface DagSnapshot {
  /** edges as [from, to] cell-id pairs (from defines a symbol that to references) */
  edges: [Ulid, Ulid][];
  /** cells with structural errors (duplicate definition / cycles) */
  structuralErrors: { cellId: Ulid; error: EvalError }[];
  /** topological order of evaluable cells */
  order: Ulid[];
}

// MIME bundle: every result has text/plain; plots/checks add a typed repr.
export interface MimeBundle {
  'text/plain': string;
  'application/vnd.proarch.plot+json'?: PlotSpec;
  'application/vnd.proarch.check+json'?: CheckResult;
  'application/vnd.proarch.quantity+json'?: { value: number; unit: string };
}

export type CellOp =
  | { t: 'insert'; after: Ulid | null; cell: Cell }
  | { t: 'update'; cellId: Ulid; source: string; /** display metadata for pending review */ label?: string; before?: string; afterText?: string; reason?: string }
  | { t: 'delete'; cellId: Ulid }
  | { t: 'set_param'; cellId: Ulid; value: ParamValue; label?: string; before?: string; afterText?: string; reason?: string };

export type Event =
  | { ev: 'status'; state: KernelState }
  | { ev: 'dag_updated'; snapshot: DagSnapshot }
  | { ev: 'plan_started'; generation: number; cells: Ulid[]; shadow: boolean }
  | { ev: 'cell_status'; generation: number; cellId: Ulid; state: CellState; shadow: boolean }
  | { ev: 'display_data'; generation: number; cellId: Ulid; data: MimeBundle; shadow: boolean }
  | { ev: 'cell_error'; generation: number; cellId: Ulid; error: EvalError; shadow: boolean }
  | { ev: 'plan_finished'; generation: number; outcome: 'completed' | 'cancelled' | 'aborted'; shadow: boolean }
  | { ev: 'cells_changed'; origin: Origin; ops: CellOp[]; pending: boolean };

// ---- agent sub-protocol (spec Part B) ----

export type AgentMode = 'auto' | 'propose';

export type ContextScope =
  | { scope: 'cell'; id: Ulid }
  | { scope: 'subgraph'; id: Ulid; up: boolean; down: boolean }
  | { scope: 'selection'; ids: Ulid[] }
  | { scope: 'notebook' };

export type AgentEventKind =
  | { k: 'delta'; text: string }
  | { k: 'tool_call'; callId: string; tool: string; summary: string }
  | { k: 'tool_result'; callId: string; ok: boolean; summary: string }
  | { k: 'pending_ready'; ops: CellOp[]; shadowGeneration?: number }
  | { k: 'done'; outcome: 'completed' | 'aborted' | { error: string } };

export interface AgentEvent {
  turnId: Ulid;
  kind: AgentEventKind;
}

export type PendingDecision =
  | { d: 'accept_all' }
  | { d: 'reject_all' }
  | { d: 'partial'; accept: number[] }; // op indices

export interface JournalEntry {
  seq: number;
  origin: Origin;
  op: CellOp;
  inverse: CellOp;
  ts: number;
}
