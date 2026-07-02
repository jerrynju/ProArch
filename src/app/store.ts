// UI state + kernel session binding. Sessions are the kernel protocol
// boundary: components send Requests and read session state; a `tick`
// counter bumped on kernel events drives re-render (event-sourced UI).

import { create } from 'zustand';
import { parseProMd } from '../core/promd/parse';
import { serializeProMd } from '../core/promd/serialize';
import { KernelSession, makeCell } from '../core/kernel/kernel';
import { AgentOrchestrator, type AgentSendMode } from '../core/agent/orchestrator';
import { ALL_PACKAGES } from '../core/packages/rf';
import { mergedActions, type ActionDecl } from '../core/actions/registry';
import type { Ulid } from '../core/model/types';
import beamRaw from '../../notebooks/cantilever-beam.pro.md?raw';
import rfRaw from '../../notebooks/rf-link-budget.pro.md?raw';

export type Mode = 'home' | 'calc' | 'feed' | 'read';

export interface NotebookFile {
  path: string;
  fileName: string; // display name, .pro.md
  raw: string;
  project: string; // drawer folder
  recency: string;
}

export const NOTEBOOK_FILES: NotebookFile[] = [
  { path: 'notebooks/cantilever-beam.pro.md', fileName: '悬臂梁挠度.pro.md', raw: beamRaw, project: 'beam', recency: '2分钟前' },
  { path: 'notebooks/rf-link-budget.pro.md', fileName: 'X波段链路预算.pro.md', raw: rfRaw, project: 'rfcomm', recency: '1小时前' },
];

export interface ChatStep { tool: string; summary: string; ok?: boolean }
export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  steps: ChatStep[];
  streaming?: boolean;
  turnId?: Ulid;
}

interface SessionBundle {
  session: KernelSession;
  agent: AgentOrchestrator;
  messages: ChatMessage[];
  actions: ActionDecl[];
}

const bundles = new Map<string, SessionBundle>();

function greeting(path: string): ChatMessage {
  const isRf = path.includes('rf');
  return {
    id: 'greet',
    role: 'agent',
    steps: [],
    text: isRf
      ? '你好,我是本笔记本的分析助手。需要我帮你评估链路余量或调整链路参数吗?'
      : '你好,我是本笔记本的分析助手。需要我帮你检查挠度计算的边界条件吗?',
  };
}

export function getBundle(path: string): SessionBundle {
  let b = bundles.get(path);
  if (!b) {
    const file = NOTEBOOK_FILES.find((f) => f.path === path)!;
    const { notebook } = parseProMd(file.raw);
    const session = new KernelSession(notebook, ALL_PACKAGES);
    const agent = new AgentOrchestrator(session);
    b = { session, agent, messages: [greeting(path)], actions: mergedActions(session.capabilities) };
    bundles.set(path, b);

    session.subscribe(() => useStore.getState().bump());
    agent.subscribe((e) => {
      const state = useStore.getState();
      const msgs = b!.messages;
      let cur = msgs.find((m) => m.turnId === e.turnId);
      if (!cur) {
        cur = { id: e.turnId, turnId: e.turnId, role: 'agent', text: '', steps: [], streaming: true };
        msgs.push(cur);
      }
      const k = e.kind;
      if (k.k === 'delta') cur.text += k.text;
      else if (k.k === 'tool_call') cur.steps.push({ tool: k.tool, summary: k.summary });
      else if (k.k === 'tool_result') {
        const step = cur.steps[cur.steps.length - 1];
        if (step) step.ok = k.ok;
      } else if (k.k === 'done') {
        cur.streaming = false;
        state.setAgentBusy(false);
      }
      state.bump();
    });
  }
  return b;
}

function download(name: string, content: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

interface Store {
  tick: number;
  bump: () => void;

  notebookPath: string;
  mode: Mode;
  selectedCellId: Ulid | null;
  expanded: Record<string, boolean>;
  sourceHidden: Record<string, boolean>;

  drawerOpen: boolean;
  drawerView: 'main' | 'account' | 'favorites' | 'newProject' | 'settings' | 'login';
  folderOpen: Record<string, boolean>;
  agentsOpen: boolean;
  agentsView: 'list' | 'settings';
  artifactsOpen: boolean;
  moreMenuOpen: boolean;
  pendingOpen: boolean;

  actionMode: 'tools' | 'chat';
  actionExpanded: boolean;
  actionTab: 'cell' | 'insert' | 'ai';
  actionSubView: null | 'compute' | 'plot';
  actionSubExpanded: boolean;
  quickParamOpen: boolean;
  chartRunning: boolean;
  agentBusy: boolean;
  agentMode: AgentSendMode;
  slashPanelOpen: boolean;
  chatInput: string;

  feedIndex: number;
  feedOverview: boolean;
  feedActionMenuOpen: boolean;
  readCollapsed: boolean;

  dark: boolean;
  isLoggedIn: boolean;
  showUpdateInfo: boolean;
  aiModel: 'standard' | 'deep' | 'fast';
  thinkingDepth: number;
  autoVerify: boolean;
  autoChart: boolean;
  autoAlert: boolean;

  set: (p: Partial<Store>) => void;
  openNotebook: (path: string, mode?: Mode) => void;
  goMode: (m: Mode) => void;
  selectCell: (id: Ulid) => void;
  toggleExpand: (id: Ulid) => void;
  toggleSource: (id: Ulid) => void;
  setParam: (cellId: Ulid, value: number) => void;
  sendPrompt: (text: string, opts?: { cellId?: Ulid }) => void;
  setAgentBusy: (v: boolean) => void;
  resolvePending: (d: 'accept_all' | 'reject_all' | number[]) => void;
  cellAction: (cmd: 'move_up' | 'move_down' | 'duplicate' | 'delete') => void;
  insertSnippet: (kind: 'code' | 'markdown', template: string, title?: string) => void;
  exportNotebook: () => void;
  exportScript: () => void;
}

export const useStore = create<Store>((set, get) => ({
  tick: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),

  notebookPath: NOTEBOOK_FILES[0].path,
  mode: 'calc',
  selectedCellId: 'beam-verify',
  expanded: {},
  sourceHidden: {},

  drawerOpen: false,
  drawerView: 'main',
  folderOpen: { stru: true, beam: true, column: false, circuit: false, rfcomm: true },
  agentsOpen: false,
  agentsView: 'list',
  artifactsOpen: false,
  moreMenuOpen: false,
  pendingOpen: false,

  actionMode: 'tools',
  actionExpanded: true,
  actionTab: 'cell',
  actionSubView: null,
  actionSubExpanded: false,
  quickParamOpen: false,
  chartRunning: false,
  agentBusy: false,
  agentMode: 'chat',
  slashPanelOpen: false,
  chatInput: '',

  feedIndex: 0,
  feedOverview: false,
  feedActionMenuOpen: false,
  readCollapsed: false,

  dark: false,
  isLoggedIn: true,
  showUpdateInfo: false,
  aiModel: 'standard',
  thinkingDepth: 1,
  autoVerify: true,
  autoChart: false,
  autoAlert: true,

  set: (p) => set(p),

  openNotebook: (path, mode = 'calc') => {
    getBundle(path);
    set({
      notebookPath: path, mode, drawerOpen: false, drawerView: 'main', selectedCellId: null,
      feedIndex: 0, actionMode: 'tools', actionSubView: null, pendingOpen: false,
    });
  },

  goMode: (m) => set({ mode: m, feedOverview: false }),

  selectCell: (id) => set({ selectedCellId: id }),
  toggleExpand: (id) => set((s) => ({ expanded: { ...s.expanded, [id]: !(s.expanded[id] ?? true) } })),
  toggleSource: (id) => set((s) => ({ sourceHidden: { ...s.sourceHidden, [id]: !s.sourceHidden[id] } })),

  setParam: (cellId, value) => {
    getBundle(get().notebookPath).session.request({ op: 'set_param', cellId, value });
  },

  sendPrompt: (text, opts = {}) => {
    const { notebookPath, agentMode } = get();
    const b = getBundle(notebookPath);
    b.messages.push({ id: `u${Date.now()}`, role: 'user', text, steps: [] });
    set({ agentBusy: true, chatInput: '', slashPanelOpen: false });
    b.agent.prompt({ text, mode: agentMode, cellId: opts.cellId ?? get().selectedCellId ?? undefined });
    get().bump();
  },

  setAgentBusy: (v) => set({ agentBusy: v }),

  resolvePending: (d) => {
    const b = getBundle(get().notebookPath);
    if (d === 'accept_all') b.session.resolvePending({ d: 'accept_all' });
    else if (d === 'reject_all') b.session.resolvePending({ d: 'reject_all' });
    else b.session.resolvePending({ d: 'partial', accept: d });
    set({ pendingOpen: false });
    get().bump();
  },

  cellAction: (cmd) => {
    const { notebookPath, selectedCellId } = get();
    if (!selectedCellId) return;
    const { session } = getBundle(notebookPath);
    const cells = session.notebook.cells;
    const idx = cells.findIndex((c) => c.id === selectedCellId);
    if (idx < 0) return;
    if (cmd === 'delete') {
      session.request({ op: 'delete_cell', cellId: selectedCellId });
      set({ selectedCellId: null });
    } else if (cmd === 'duplicate') {
      const orig = cells[idx];
      const copy = makeCell(JSON.parse(JSON.stringify(orig.kind)));
      copy.viewHints = JSON.parse(JSON.stringify(orig.viewHints));
      session.request({ op: 'insert_cell', after: orig.id, cell: copy });
    } else {
      const to = cmd === 'move_up' ? idx - 1 : idx + 1;
      if (to < 0 || to >= cells.length) return;
      const [c] = cells.splice(idx, 1);
      cells.splice(to, 0, c);
    }
    get().bump();
  },

  insertSnippet: (kind, template, title) => {
    const { notebookPath, selectedCellId } = get();
    const { session } = getBundle(notebookPath);
    const after = selectedCellId ?? session.notebook.cells[session.notebook.cells.length - 1]?.id ?? null;
    const cell = makeCell(kind === 'code'
      ? { type: 'code', source: template, lang: 'rhai', title }
      : { type: 'markdown', source: template });
    if (title) cell.viewHints = { calc: { title } };
    session.request({ op: 'insert_cell', after, cell });
    set({ actionSubView: null, selectedCellId: cell.id });
    get().bump();
  },

  exportNotebook: () => {
    const { notebookPath } = get();
    const { session } = getBundle(notebookPath);
    const file = NOTEBOOK_FILES.find((f) => f.path === notebookPath)!;
    download(file.fileName, serializeProMd(session.notebook), 'text/markdown');
  },

  exportScript: () => {
    const { notebookPath } = get();
    const { session } = getBundle(notebookPath);
    const nb = session.notebook;
    const lines: string[] = [`%% ${nb.meta.title} — ProArch 导出`, ''];
    for (const c of nb.cells) {
      if (c.kind.type === 'param') {
        const unit = 'unit' in c.kind.control ? c.kind.control.unit ?? '' : '';
        lines.push(`${c.kind.name} = ${typeof c.kind.value === 'object' ? (c.kind.value as { value: number }).value : c.kind.value}; % ${c.kind.label ?? ''} ${unit}`.trimEnd());
      } else if (c.kind.type === 'code') {
        lines.push('', `%% ${c.kind.title ?? '计算单元'}`);
        for (const src of c.kind.source.split('\n')) {
          lines.push(src.replace(/^let\s+/, '').replace(/\/\//g, '%'));
        }
      }
    }
    download(nb.meta.title.replace(/\s/g, '_') + '.m', lines.join('\n'));
  },
}));

/** convenience selector used across components */
export function useSession() {
  const path = useStore((s) => s.notebookPath);
  useStore((s) => s.tick); // subscribe to kernel events
  return getBundle(path);
}
