// UI state + kernel session binding. Sessions are the kernel protocol
// boundary: components send Requests and read session state; a `tick`
// counter bumped on kernel events drives re-render (event-sourced UI).

import { create } from 'zustand';
import { parseProMd } from '../core/promd/parse';
import { serializeProMd } from '../core/promd/serialize';
import { KernelSession, makeCell, dedupeSymbols } from '../core/kernel/kernel';
import { AgentOrchestrator, type AgentSendMode } from '../core/agent/orchestrator';
import { ALL_PACKAGES } from '../core/packages';
import { PackageRegistry } from '../core/packages/registry';
import { EvolutionStore } from '../core/evolve/evolution';
import { mergedActions, type ActionDecl } from '../core/actions/registry';
import type { Ulid } from '../core/model/types';
import { ulid } from '../core/model/ulid';
import beamRaw from '../../notebooks/cantilever-beam.pro.md?raw';
import rfRaw from '../../notebooks/rf-link-budget.pro.md?raw';
import ssBeamRaw from '../../notebooks/simply-supported-beam.pro.md?raw';
import rcRaw from '../../notebooks/rc-transient.pro.md?raw';
import stressRaw from '../../notebooks/stress-check.pro.md?raw';

export type Mode = 'home' | 'calc' | 'feed' | 'read';

export interface NotebookFile {
  path: string;
  fileName: string; // display name, .pro.md
  raw: string;
  project: string; // drawer folder
  recency: string;
}

/** Seed set — the registry (`store.files`) starts from these; blank/imported
 * notebooks are appended at runtime. */
export const NOTEBOOK_FILES: NotebookFile[] = [
  { path: 'notebooks/cantilever-beam.pro.md', fileName: '悬臂梁挠度.pro.md', raw: beamRaw, project: 'beam', recency: '2分钟前' },
  { path: 'notebooks/rf-link-budget.pro.md', fileName: 'X波段链路预算.pro.md', raw: rfRaw, project: 'rfcomm', recency: '1小时前' },
  { path: 'notebooks/simply-supported-beam.pro.md', fileName: '简支梁弯矩分析.pro.md', raw: ssBeamRaw, project: 'beam', recency: '昨天' },
  { path: 'notebooks/rc-transient.pro.md', fileName: 'RC电路暂态响应.pro.md', raw: rcRaw, project: 'circuit', recency: '2天前' },
  { path: 'notebooks/stress-check.pro.md', fileName: '应力校核清单.pro.md', raw: stressRaw, project: 'stru', recency: '3天前' },
];

/** Minimal starter notebook for 新建空白项目. */
export function blankNotebookRaw(title: string): string {
  return `---
pro: 1
id: ${ulid()}
title: ${title}
subtitle: 空白项目
default_view: calc
view_hints:
  blank-x:
    calc: { group: main }
  blank-compute:
    calc: { group: main, title: 计算, icon: calc }
---

# ${title}

在这里描述你的计算目标。底部工具栏的「插入」页可以添加参数、公式与校核单元。

\`\`\`param {#blank-x name=x control=slider min=0 max=100 step=1 label="输入参数 x"}
10
\`\`\`

\`\`\`rhai {#blank-compute .cell title="计算"}
let y = x * 2.0;
quantity(y, "")
\`\`\`
`;
}

export function projectOf(path: string): string | undefined {
  return useStore.getState().files.find((f) => f.path === path)?.project
    ?? NOTEBOOK_FILES.find((f) => f.path === path)?.project;
}

export interface RecentConversation { path: string; title: string; sub: string; when: string }

// Demo seed data — scoped to a project (spec §5: home surfaces recents for
// the active project only, never the whole workspace).
export const RECENT_CONVERSATIONS: RecentConversation[] = [
  { path: NOTEBOOK_FILES[0].path, title: '规范校核讨论', sub: '当前参数下是否满足 L/250…', when: '2小时前' },
  { path: NOTEBOOK_FILES[1].path, title: 'RF 链路余量', sub: '50 km 时链路余量是否足够…', when: '昨天' },
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

/** Workspace-level shared state: one package registry and one self-evolution
 * store across every notebook session — a function promoted in one notebook
 * is immediately callable in all of them. */
export const WORKSPACE_REGISTRY = new PackageRegistry();
for (const p of ALL_PACKAGES) WORKSPACE_REGISTRY.register(p);
export const WORKSPACE_EVOLUTION = new EvolutionStore();

function greeting(path: string): ChatMessage {
  const text = path.includes('rf-link')
    ? '你好,我是本笔记本的分析助手。需要我帮你评估链路余量或调整链路参数吗?'
    : path.includes('rc-transient')
      ? '你好,我是本笔记本的分析助手。需要我帮你分析时间常数或调整 RC 参数吗?'
      : '你好,我是本笔记本的分析助手。需要我帮你检查计算的边界条件吗?';
  return { id: 'greet', role: 'agent', steps: [], text };
}

export function getBundle(path: string): SessionBundle {
  let b = bundles.get(path);
  if (!b) {
    const file = useStore.getState().files.find((f) => f.path === path)!;
    const { notebook } = parseProMd(file.raw);
    const session = new KernelSession(notebook, WORKSPACE_REGISTRY, { evolution: WORKSPACE_EVOLUTION });
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

let toastTimer: ReturnType<typeof setTimeout> | undefined;

interface Store {
  tick: number;
  bump: () => void;

  /** notebook registry: seed files + runtime-created/imported ones */
  files: NotebookFile[];

  notebookPath: string;
  mode: Mode;
  selectedCellId: Ulid | null;
  expanded: Record<string, boolean>;
  sourceHidden: Record<string, boolean>;

  /** measured height (px) of whichever floating bottom toolbar is on screen —
   * content views reserve this much bottom padding so cards never end up
   * hidden behind it (spec: three-view shared toolbar shell). */
  toolbarHeight: number;
  toast: { id: number; message: string } | null;
  showToast: (message: string) => void;
  /** symbol currently open in the Wolfram-style inspect sheet */
  inspectSymbol: string | null;
  /** TikTok-style first-run swipe hint on the Feed view */
  feedHintSeen: boolean;

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

  createBlankNotebook: (project?: string) => void;
  importNotebookRaw: (fileName: string, raw: string) => void;
  copyNotebookLink: () => void;
  shareNotebook: () => void;
  loadPackage: (name: string) => void;
  promoteFunction: (cellId: Ulid, symbol: string) => void;
}

export const useStore = create<Store>((set, get) => ({
  tick: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),

  files: [...NOTEBOOK_FILES],

  notebookPath: NOTEBOOK_FILES[0].path,
  mode: 'calc',
  selectedCellId: 'beam-verify',
  expanded: {},
  sourceHidden: {},
  toolbarHeight: 190,
  toast: null,
  inspectSymbol: null,
  feedHintSeen: false,

  drawerOpen: false,
  drawerView: 'main',
  folderOpen: { stru: true, beam: true, column: false, circuit: false, rfcomm: true, local: true },
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

  showToast: (message) => {
    clearTimeout(toastTimer);
    set({ toast: { id: Date.now(), message } });
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },

  openNotebook: (path, mode = 'calc') => {
    getBundle(path);
    set({
      notebookPath: path, mode, drawerOpen: false, drawerView: 'main', selectedCellId: null,
      feedIndex: 0, actionMode: 'tools', actionSubView: null, pendingOpen: false, inspectSymbol: null,
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
    // auto-rename any `let name = …` that would collide with a symbol
    // already defined elsewhere in the notebook (DAG allows one definer)
    const source = kind === 'code' ? dedupeSymbols(template, session.definedSymbols()) : template;
    const cell = makeCell(kind === 'code'
      ? { type: 'code', source, lang: 'rhai', title }
      : { type: 'markdown', source });
    if (title) cell.viewHints = { calc: { title } };
    session.request({ op: 'insert_cell', after, cell });
    set({ actionSubView: null, selectedCellId: cell.id });
    get().bump();
  },

  exportNotebook: () => {
    const { notebookPath, files } = get();
    const { showToast } = get();
    const { session } = getBundle(notebookPath);
    const file = files.find((f) => f.path === notebookPath)!;
    download(file.fileName, serializeProMd(session.notebook), 'text/markdown');
    showToast(`已下载 ${file.fileName}`);
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
    const name = nb.meta.title.replace(/\s/g, '_') + '.m';
    download(name, lines.join('\n'));
    get().showToast(`已下载 ${name}`);
  },

  loadPackage: (name) => {
    const { notebookPath, showToast } = get();
    const { session } = getBundle(notebookPath);
    const before = new Set(session.attachedPackages().map((p) => p.name));
    const reply = session.request({ op: 'load_package', name });
    if (reply.op === 'err') {
      showToast(reply.error.message);
    } else {
      const deps = session.attachedPackages().map((p) => p.name).filter((n) => n !== name && !before.has(n));
      showToast(deps.length > 0 ? `已加载域包 ${name}(自动附加依赖 ${deps.join('、')})` : `已为当前笔记本加载域包 ${name}`);
    }
    get().bump();
  },

  promoteFunction: (cellId, symbol) => {
    const { notebookPath, showToast } = get();
    const { session } = getBundle(notebookPath);
    const reply = session.request({ op: 'promote_function', cellId, symbol });
    if (reply.op === 'err') showToast(reply.error.message);
    else showToast(`已沉淀 ${symbol} 到工作区函数库 · learned v${WORKSPACE_EVOLUTION.version}`);
    set({ inspectSymbol: null });
    get().bump();
  },

  createBlankNotebook: (project = 'local') => {
    const files = get().files;
    const n = files.filter((f) => f.path.startsWith('local/untitled-')).length + 1;
    const title = n === 1 ? '未命名笔记本' : `未命名笔记本 ${n}`;
    const file: NotebookFile = {
      path: `local/untitled-${n}.pro.md`,
      fileName: `${title}.pro.md`,
      raw: blankNotebookRaw(title),
      project,
      recency: '刚刚',
    };
    set({ files: [...files, file] });
    get().openNotebook(file.path);
    get().showToast('已创建空白笔记本');
  },

  importNotebookRaw: (fileName, raw) => {
    try {
      const { notebook, diagnostics } = parseProMd(raw);
      if (notebook.cells.length === 0) throw new Error('没有可识别的单元');
      const files = get().files;
      let path = `local/${fileName}`;
      let n = 2;
      while (files.some((f) => f.path === path)) path = `local/${n++}-${fileName}`;
      const file: NotebookFile = {
        path,
        fileName: fileName.endsWith('.pro.md') ? fileName : `${notebook.meta.title}.pro.md`,
        raw, project: 'local', recency: '刚刚',
      };
      set({ files: [...files, file] });
      get().openNotebook(file.path);
      get().showToast(diagnostics.length > 0 ? `已导入(${diagnostics.length} 条解析提示)` : `已导入 ${notebook.meta.title}`);
    } catch (e) {
      get().showToast(`导入失败:${(e as Error).message ?? '无法解析文件'}`);
    }
  },

  copyNotebookLink: () => {
    const { session } = getBundle(get().notebookPath);
    const url = `https://proarch.app/nb/${session.notebook.id}`;
    const done = () => get().showToast('链接已复制到剪贴板');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
    set({ moreMenuOpen: false });
  },

  shareNotebook: () => {
    const { session } = getBundle(get().notebookPath);
    const url = `https://proarch.app/nb/${session.notebook.id}`;
    const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
    if (nav.share) {
      nav.share({ title: session.notebook.meta.title, url }).catch(() => {});
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => get().showToast('系统分享不可用,已复制分享链接'),
        () => get().showToast('分享失败'),
      );
    } else {
      get().showToast('当前环境不支持分享');
    }
    set({ moreMenuOpen: false });
  },
}));

/** convenience selector used across components */
export function useSession() {
  const path = useStore((s) => s.notebookPath);
  useStore((s) => s.tick); // subscribe to kernel events
  return getBundle(path);
}
