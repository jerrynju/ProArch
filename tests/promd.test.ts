import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseProMd } from '../src/core/promd/parse';
import { serializeProMd } from '../src/core/promd/serialize';

const beamSrc = readFileSync(new URL('../notebooks/cantilever-beam.pro.md', import.meta.url), 'utf8');

describe('.pro.md parser', () => {
  it('parses the beam notebook', () => {
    const { notebook } = parseProMd(beamSrc);
    expect(notebook.meta.title).toBe('悬臂梁挠度分析');
    expect(notebook.meta.defaultView).toBe('calc');
    const kinds = notebook.cells.map((c) => c.kind.type);
    expect(kinds).toContain('markdown');
    expect(kinds).toContain('param');
    expect(kinds).toContain('code');
    expect(kinds).toContain('unknown'); // placeholder blocks preserved
    const f = notebook.cells.find((c) => c.kind.type === 'param' && c.kind.name === 'F');
    expect(f).toBeDefined();
    expect(f!.kind.type === 'param' && f!.kind.value).toBe(10);
    expect(f!.kind.type === 'param' && f!.kind.control.kind === 'slider' && f!.kind.control.max).toBe(50);
  });

  it('applies view hints by cell id', () => {
    const { notebook } = parseProMd(beamSrc);
    const compute = notebook.cells.find((c) => c.id === 'beam-compute')!;
    expect(compute.viewHints.calc?.group).toBe('deflection');
    expect(compute.viewHints.calc?.title).toBe('挠度计算');
  });

  it('round-trips through serialize → parse', () => {
    const { notebook } = parseProMd(beamSrc);
    const text = serializeProMd(notebook);
    const again = parseProMd(text).notebook;
    expect(again.meta.title).toBe(notebook.meta.title);
    expect(again.cells.filter((c) => c.kind.type !== 'markdown').map((c) => c.id))
      .toEqual(notebook.cells.filter((c) => c.kind.type !== 'markdown').map((c) => c.id));
    const src = (id: string, nb = again) => {
      const cell = nb.cells.find((c) => c.id === id)!;
      return cell.kind.type === 'code' ? cell.kind.source : '';
    };
    expect(src('beam-compute')).toBe(src('beam-compute', notebook));
  });

  it('preserves unknown blocks verbatim', () => {
    const input = '---\npro: 1\ntitle: t\n---\n\n```mystery {#x1 foo=bar}\nsome payload\n```\n';
    const { notebook } = parseProMd(input);
    const unknown = notebook.cells.find((c) => c.kind.type === 'unknown')!;
    expect(unknown.kind.type === 'unknown' && unknown.kind.raw).toBe('some payload');
    const out = serializeProMd(notebook);
    expect(out).toContain('```mystery {#x1 foo=bar}\nsome payload\n```');
  });

  it('backfills missing cell ids', () => {
    const input = '---\npro: 1\ntitle: t\n---\n\n```rhai {.cell}\nlet a = 1.0;\n```\n';
    const res = parseProMd(input);
    expect(res.idsBackfilled).toBe(true);
    const code = res.notebook.cells.find((c) => c.kind.type === 'code')!;
    expect(code.id.length).toBeGreaterThanOrEqual(10);
  });
});
