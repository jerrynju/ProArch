import { useCallback, useRef, useState } from 'react';
import { M3 } from '../theme';
import { NOTEBOOK_FILES, useSession, useStore } from '../store';
import { deriveCards } from '../derive';
import { IconButton, SegTab, ToolbarShell } from '../components/widgets';
import { useMeasuredHeight } from '../hooks/useMeasuredHeight';
import { IcArrowUp, IcChevronDown, IcChevronRight, IcFile } from '../components/icons';
import type { KernelSession } from '../../core/kernel/kernel';

/**
 * Obsidian-style properties panel: the .pro.md frontmatter projected as a
 * collapsible key/value card at the top of the document view. Nothing here
 * is view state — every row reads straight from the file's metadata, which
 * is exactly the Obsidian "Properties" mental model.
 */
function PropertiesCard({ session }: { session: KernelSession }) {
  const [open, setOpen] = useState(true);
  const nb = session.notebook;
  const file = NOTEBOOK_FILES.find((f) => f.path === useStore.getState().notebookPath);
  const counts = { code: 0, param: 0, markdown: 0, other: 0 };
  for (const c of nb.cells) {
    if (c.kind.type === 'code') counts.code += 1;
    else if (c.kind.type === 'param') counts.param += 1;
    else if (c.kind.type === 'markdown') counts.markdown += 1;
    else counts.other += 1;
  }
  const modified = typeof nb.meta.extra['modified'] === 'string'
    ? new Date(nb.meta.extra['modified']).toLocaleString('zh-CN', { hour12: false })
    : '—';
  const rows: [string, string][] = [
    ['文件', file?.fileName ?? nb.meta.title],
    ['领域包', nb.meta.packages.length > 0 ? nb.meta.packages.map((p) => `${p.name} ${p.version}`).join(', ') : '无'],
    ['单元', `${counts.code} 计算 · ${counts.param} 参数 · ${counts.markdown} 文本${counts.other > 0 ? ` · ${counts.other} 其他` : ''}`],
    ['默认视图', nb.meta.defaultView],
    ['最后修改', modified],
  ];
  return (
    <div style={{ background: M3.surfaceLow, borderRadius: 14, padding: '4px 14px', marginBottom: 14 }} data-testid="read-properties">
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', cursor: 'pointer' }}>
        <IcFile size={14} color={M3.textTertiary} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: M3.textTertiary, letterSpacing: '.03em', flex: 1 }}>文档属性</span>
        <div style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s', display: 'flex' }}>
          <IcChevronDown size={14} color={M3.textTertiary} />
        </div>
      </div>
      {open && (
        <div style={{ paddingBottom: 10 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 12, padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: M3.textFaint, width: 58, flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: 12, color: M3.textSecondary, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReadView() {
  const { session } = useSession();
  const cards = deriveCards(session);
  const { readCollapsed, toolbarHeight, selectedCellId, set, goMode, selectCell } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const measureRef = useMeasuredHeight<HTMLDivElement>(
    useCallback((h) => useStore.setState({ toolbarHeight: h + 24 }), []),
  );

  const enterEdit = (cellId?: string) => {
    if (cellId) selectCell(cellId);
    goMode('calc');
  };

  return (
    <>
      <div ref={ref} style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: `18px 16px ${toolbarHeight}px`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {cards.map((card) => {
          if (card.kind === 'section') {
            return (
              <div key={card.key}>
                <div style={{ fontSize: 20, fontWeight: 700, color: M3.text, padding: '6px 4px 12px' }}>{card.title}</div>
                <PropertiesCard session={session} />
              </div>
            );
          }
          if (card.kind === 'note') {
            if (readCollapsed) return null;
            return (
              <div key={card.key} style={{ fontSize: 13.5, lineHeight: 1.6, color: M3.textSecondary, padding: '10px 4px', borderBottom: `1px solid ${M3.surfaceContainer}` }}>
                {card.summary}
              </div>
            );
          }
          const isPlaceholder = card.kind === 'placeholder';
          const clickable = card.kind === 'compute' || card.kind === 'plot' || card.kind === 'error';
          const selected = card.cell?.id != null && card.cell.id === selectedCellId;
          return (
            <div
              key={card.key}
              onClick={clickable ? () => enterEdit(card.cell?.id) : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '14px 8px 14px 10px',
                borderBottom: `1px solid ${M3.surfaceContainer}`, cursor: clickable ? 'pointer' : 'default',
                background: selected ? M3.surfaceLow : undefined,
                boxShadow: selected ? `inset 3px 0 0 ${M3.primary}` : undefined,
                borderRadius: selected ? '0 10px 10px 0' : undefined,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: M3.text }}>{card.title}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: M3.textFaint, background: M3.surfaceContainer, padding: '2px 6px', borderRadius: 6, flexShrink: 0 }}>
                    {card.overviewLabel}
                  </span>
                </div>
                {!readCollapsed && (
                  <div style={{ fontSize: 12.5, color: card.kind === 'error' ? M3.onErrorContainer : card.kind === 'check' ? M3.textSecondary : M3.textTertiary, marginTop: 2 }}>
                    {card.summary}
                  </div>
                )}
              </div>
              {isPlaceholder && (
                <div style={{ fontSize: 10.5, color: M3.textTertiary, background: M3.surfaceContainer, padding: '3px 8px', borderRadius: 8 }}>占位</div>
              )}
              {clickable && <IcChevronRight size={18} color={M3.textTertiary} />}
            </div>
          );
        })}
      </div>

      {/* bottom toolbar — same floating-card shell as Calc's action stack */}
      <ToolbarShell testId="read-toolbar" style={{ padding: '10px 14px 14px' }}>
        <div ref={measureRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconButton size={32} onClick={() => { if (ref.current) ref.current.scrollTop = 0; }} style={{ background: '#FFFFFF' }}>
              <IcArrowUp size={17} color={M3.primary} />
            </IconButton>
            <IconButton size={32} onClick={() => set({ readCollapsed: !readCollapsed })} style={{ background: '#FFFFFF' }} testId="read-collapse">
              <div style={{ transform: readCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', display: 'flex' }}>
                <IcChevronDown size={17} color={M3.textSecondary} />
              </div>
            </IconButton>
            <span style={{ fontSize: 11.5, color: M3.textTertiary, flex: 1 }}>{readCollapsed ? '已折叠说明' : '回到顶部 · 折叠说明'}</span>
          </div>
          <div style={{ display: 'flex', background: M3.surfaceContainer, borderRadius: 20, padding: 3, gap: 2 }}>
            <SegTab active={false} onClick={() => goMode('feed')}>Feed</SegTab>
            <SegTab active onClick={() => {}}>Read</SegTab>
            <SegTab active={false} onClick={() => goMode('calc')}>Calc</SegTab>
          </div>
        </div>
      </ToolbarShell>
    </>
  );
}
