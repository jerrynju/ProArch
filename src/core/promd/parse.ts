// .pro.md — ProArch notebook disk format (Markdown dialect, spec §4).
// YAML frontmatter (`pro: 1` is the magic), fenced blocks with pandoc-style
// attributes for code/param/data cells, free Markdown split into cells at
// headings. Cells missing an ID get a generated ULID (caller may rewrite the
// file). Unknown block types are preserved verbatim as Unknown cells.

import YAML from 'yaml';
import { ulid, isUlid } from '../model/ulid';
import type {
  Cell, CellKind, ControlSpec, Notebook, NotebookMeta, PackageReq, ParamValue, ViewHints, ViewMode,
} from '../model/types';

export interface ParseResult {
  notebook: Notebook;
  /** true if any cell ID was generated during parsing (file should be rewritten) */
  idsBackfilled: boolean;
  diagnostics: string[];
}

interface Attrs {
  id?: string;
  classes: string[];
  kv: Record<string, string>;
}

/** Parse a pandoc-ish attribute block: `{#id .cell key=value key="quoted"}` */
export function parseAttrs(text: string): Attrs {
  const attrs: Attrs = { classes: [], kv: {} };
  const re = /#([\w-]+)|\.([\w-]+)|([\w-]+)=("([^"]*)"|[^\s}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1]) attrs.id = m[1];
    else if (m[2]) attrs.classes.push(m[2]);
    else if (m[3]) attrs.kv[m[3]] = m[5] !== undefined ? m[5] : m[4];
  }
  return attrs;
}

function parseInfoString(info: string): { lang: string; attrs: Attrs } {
  const brace = info.indexOf('{');
  if (brace < 0) return { lang: info.trim(), attrs: { classes: [], kv: {} } };
  return { lang: info.slice(0, brace).trim(), attrs: parseAttrs(info.slice(brace)) };
}

function parseParamValue(raw: string): ParamValue {
  const t = raw.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  const n = Number(t);
  if (t !== '' && Number.isFinite(n)) return n;
  return t;
}

function controlFromAttrs(kv: Record<string, string>, body: string): { control: ControlSpec; value: ParamValue } {
  const kind = kv.control ?? 'number';
  if (kind === 'slider') {
    return {
      control: {
        kind: 'slider',
        min: Number(kv.min ?? 0),
        max: Number(kv.max ?? 100),
        step: Number(kv.step ?? 1),
        unit: kv.unit,
        logScale: kv.log === 'true' || undefined,
      },
      value: parseParamValue(body),
    };
  }
  if (kind === 'select') {
    // Rich body: YAML map with `value` and `options`.
    const doc = YAML.parse(body) as { value: ParamValue; options: { label: string; value: ParamValue }[] };
    return { control: { kind: 'select', options: doc.options ?? [] }, value: doc.value };
  }
  if (kind === 'toggle') return { control: { kind: 'toggle' }, value: body.trim() === 'true' };
  if (kind === 'text') return { control: { kind: 'text' }, value: body.trim() };
  return {
    control: {
      kind: 'number',
      min: kv.min !== undefined ? Number(kv.min) : undefined,
      max: kv.max !== undefined ? Number(kv.max) : undefined,
      unit: kv.unit,
    },
    value: parseParamValue(body),
  };
}

function metaFromFrontmatter(fm: Record<string, unknown>): { meta: NotebookMeta; id: string; formatVersion: number; viewHints: Record<string, ViewHints> } {
  const known = new Set(['pro', 'id', 'title', 'subtitle', 'packages', 'default_view', 'view_hints']);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fm)) if (!known.has(k)) extra[k] = v;

  const packages: PackageReq[] = [];
  const rawPkgs = fm.packages;
  if (Array.isArray(rawPkgs)) {
    for (const p of rawPkgs) {
      if (typeof p === 'string') packages.push({ name: p, version: '*' });
      else if (p && typeof p === 'object') {
        for (const [name, version] of Object.entries(p as Record<string, string>)) {
          packages.push({ name, version: String(version) });
        }
      }
    }
  }

  return {
    formatVersion: Number(fm.pro ?? 1),
    id: typeof fm.id === 'string' ? fm.id : ulid(),
    meta: {
      title: String(fm.title ?? '未命名笔记本'),
      subtitle: fm.subtitle !== undefined ? String(fm.subtitle) : undefined,
      packages,
      defaultView: (['feed', 'read', 'calc'].includes(String(fm.default_view)) ? fm.default_view : 'calc') as ViewMode,
      extra,
    },
    viewHints: (fm.view_hints ?? {}) as Record<string, ViewHints>,
  };
}

export function parseProMd(text: string): ParseResult {
  const diagnostics: string[] = [];
  let idsBackfilled = false;
  const lines = text.split('\n');
  let i = 0;

  // --- frontmatter ---
  let fm: Record<string, unknown> = {};
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, idx) => idx > 0 && l.trim() === '---');
    if (end > 0) {
      try {
        fm = (YAML.parse(lines.slice(1, end).join('\n')) as Record<string, unknown>) ?? {};
      } catch (e) {
        diagnostics.push(`frontmatter YAML 解析失败: ${(e as Error).message}`);
      }
      i = end + 1;
    }
  }
  if (fm.pro === undefined) diagnostics.push('缺少 pro 格式标记,按 pro: 1 处理');
  const { meta, id, formatVersion, viewHints } = metaFromFrontmatter(fm);

  // --- body: fenced blocks + markdown runs ---
  const cells: Cell[] = [];
  const takeId = (attrs: Attrs): string => {
    if (attrs.id && isUlid(attrs.id)) return attrs.id;
    if (attrs.id) return attrs.id; // stable non-ULID ids are allowed (hand-authored)
    idsBackfilled = true;
    return ulid();
  };

  const pushMarkdownRun = (run: string[]) => {
    // Split a markdown run into cells at headings (spec §4.2 rule 3).
    let current: string[] = [];
    const flush = () => {
      const src = current.join('\n').trim();
      if (src) {
        cells.push({ id: ulid(), kind: { type: 'markdown', source: src }, viewHints: {}, tags: [] });
        idsBackfilled = true;
      }
      current = [];
    };
    for (const line of run) {
      if (/^#{1,6}\s/.test(line)) flush();
      current.push(line);
    }
    flush();
  };

  let mdRun: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^```(.*)$/.exec(line);
    if (fence) {
      pushMarkdownRun(mdRun);
      mdRun = [];
      const info = fence[1].trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      const { lang, attrs } = parseInfoString(info);
      const bodyText = body.join('\n');
      const cellId = takeId(attrs);
      let kind: CellKind;
      if (lang === 'rhai') {
        kind = { type: 'code', source: bodyText, lang: 'rhai', title: attrs.kv.title };
      } else if (lang === 'param') {
        try {
          const { control, value } = controlFromAttrs(attrs.kv, bodyText);
          kind = { type: 'param', name: attrs.kv.name ?? 'param', control, value, label: attrs.kv.label };
        } catch (e) {
          diagnostics.push(`param cell ${cellId} 解析失败: ${(e as Error).message}`);
          kind = { type: 'unknown', info, raw: bodyText };
        }
      } else if (lang === 'data') {
        kind = attrs.kv.src
          ? { type: 'data', name: attrs.kv.name ?? 'data', payload: { kind: 'arrow_file', path: attrs.kv.src } }
          : { type: 'data', name: attrs.kv.name ?? 'data', payload: { kind: 'inline_csv', text: bodyText } };
      } else {
        kind = { type: 'unknown', info, raw: bodyText };
      }
      cells.push({ id: cellId, kind, viewHints: viewHints[cellId] ?? {}, tags: attrs.classes.filter((c) => c !== 'cell') });
    } else {
      mdRun.push(line);
      i++;
    }
  }
  pushMarkdownRun(mdRun);

  return {
    notebook: { formatVersion, id, meta, cells },
    idsBackfilled,
    diagnostics,
  };
}
