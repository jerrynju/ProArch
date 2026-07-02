// Canonical Cell / Notebook model — the single shared truth between disk
// format and kernel (per Cell data model spec v0.1). View-specific data is
// quarantined in ViewHints; dependency info is derived, never stored.

export type Ulid = string;
export type ViewMode = 'feed' | 'read' | 'calc';

export interface Notebook {
  formatVersion: number; // disk format version, currently 1
  id: Ulid;
  meta: NotebookMeta;
  cells: Cell[]; // document order; execution order comes from the DAG
}

export interface NotebookMeta {
  title: string;
  subtitle?: string;
  packages: PackageReq[];
  defaultView: ViewMode;
  extra: Record<string, unknown>; // forward compatibility: unknown keys round-trip
}

export interface PackageReq {
  name: string; // e.g. "rf"
  version: string; // semver requirement, e.g. "^1.0"
}

export interface Cell {
  id: Ulid;
  kind: CellKind;
  viewHints: ViewHints;
  tags: string[];
}

export type CellKind =
  | { type: 'markdown'; source: string }
  | { type: 'code'; source: string; lang: string; title?: string }
  | { type: 'param'; name: string; control: ControlSpec; value: ParamValue; label?: string }
  | { type: 'data'; name: string; payload: DataPayload }
  // Unknown block types from newer versions: keep raw text, render read-only,
  // never lose data (spec §4.2 rule 5).
  | { type: 'unknown'; info: string; raw: string };

export type ControlSpec =
  | { kind: 'slider'; min: number; max: number; step: number; unit?: string; logScale?: boolean }
  | { kind: 'number'; min?: number; max?: number; unit?: string }
  | { kind: 'select'; options: { label: string; value: ParamValue }[] }
  | { kind: 'toggle' }
  | { kind: 'text' };

export type ParamValue =
  | number
  | boolean
  | string
  | { value: number; unit: string }; // quantity

export type DataPayload =
  | { kind: 'inline_csv'; text: string }
  | { kind: 'arrow_file'; path: string };

export interface ViewHints {
  feed?: FeedHints;
  read?: ReadHints;
  calc?: CalcHints;
}

export interface FeedHints {
  card?: boolean;
  group?: string;
  cover?: boolean;
}

export interface ReadHints {
  collapsed?: boolean;
  hideOutput?: boolean;
}

export interface CalcHints {
  hideSource?: boolean;
  pinned?: boolean;
  /** ProArch extra: group label used to fold param cells into a compute card */
  group?: string;
  /** ProArch extra: card icon + title shown on the Calc card header */
  title?: string;
  icon?: string;
  placeholder?: boolean;
}

export function paramValueToNumber(v: ParamValue): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') return Number(v);
  return v.value;
}

export function cellDefines(cell: Cell): string[] {
  const k = cell.kind;
  if (k.type === 'param') return [k.name];
  if (k.type === 'data') return [k.name];
  return []; // code cells are analyzed by the kernel
}
