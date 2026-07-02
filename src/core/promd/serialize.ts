// Notebook → .pro.md text. Outputs never contain computed results (spec §6):
// only sources, param values (document state) and frontmatter.

import YAML from 'yaml';
import type { Cell, Notebook, ParamValue, ViewHints } from '../model/types';

function fmtParamValue(v: ParamValue): string {
  if (typeof v === 'object' && v !== null) return `${v.value} ${v.unit}`;
  return String(v);
}

function attrString(pairs: Record<string, string | number | undefined>): string {
  return Object.entries(pairs)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => {
      const s = String(v);
      return /[\s"}]/.test(s) ? `${k}="${s}"` : `${k}=${s}`;
    })
    .join(' ');
}

function serializeCell(cell: Cell): string {
  const k = cell.kind;
  switch (k.type) {
    case 'markdown':
      return k.source;
    case 'code': {
      const extra = attrString({ title: k.title });
      return `\`\`\`rhai {#${cell.id} .cell${extra ? ' ' + extra : ''}}\n${k.source}\n\`\`\``;
    }
    case 'param': {
      if (k.control.kind === 'select') {
        const extra = attrString({ name: k.name, control: 'select', label: k.label });
        const body = YAML.stringify({ value: k.value, options: k.control.options }).trimEnd();
        return `\`\`\`param {#${cell.id} ${extra}}\n${body}\n\`\`\``;
      }
      const c = k.control;
      const extra = attrString({
        name: k.name,
        control: c.kind,
        min: 'min' in c ? c.min : undefined,
        max: 'max' in c ? c.max : undefined,
        step: c.kind === 'slider' ? c.step : undefined,
        unit: 'unit' in c ? c.unit : undefined,
        label: k.label,
      });
      return `\`\`\`param {#${cell.id} ${extra}}\n${fmtParamValue(k.value)}\n\`\`\``;
    }
    case 'data': {
      if (k.payload.kind === 'arrow_file') {
        return `\`\`\`data {#${cell.id} ${attrString({ name: k.name, src: k.payload.path })}}\n\`\`\``;
      }
      return `\`\`\`data {#${cell.id} ${attrString({ name: k.name })}}\n${k.payload.text}\n\`\`\``;
    }
    case 'unknown':
      // Never lose data we didn't understand.
      return `\`\`\`${k.info}\n${k.raw}\n\`\`\``;
  }
}

export function serializeProMd(nb: Notebook): string {
  const viewHints: Record<string, ViewHints> = {};
  for (const c of nb.cells) {
    if (c.viewHints && Object.keys(c.viewHints).length > 0) viewHints[c.id] = c.viewHints;
  }
  const fm: Record<string, unknown> = {
    pro: nb.formatVersion,
    id: nb.id,
    title: nb.meta.title,
    ...(nb.meta.subtitle !== undefined ? { subtitle: nb.meta.subtitle } : {}),
    ...(nb.meta.packages.length > 0
      ? { packages: nb.meta.packages.map((p) => ({ [p.name]: p.version })) }
      : {}),
    default_view: nb.meta.defaultView,
    ...(Object.keys(viewHints).length > 0 ? { view_hints: viewHints } : {}),
    ...nb.meta.extra,
  };
  const body = nb.cells.map(serializeCell).join('\n\n');
  return `---\n${YAML.stringify(fm).trimEnd()}\n---\n\n${body}\n`;
}
