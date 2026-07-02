// Read mode: a continuous document flow (Obsidian-style), not a table of
// contents. Markdown renders as prose, code cells fold into a small "查看
// 源码" toggle by default (spec: ReadHints.collapsed), and compute/plot/check
// outputs are embedded inline instead of routed through a list-row tap.
import { useRef, useState } from 'react';
import { M3 } from '../theme';
import { useSession, useStore } from '../store';
import { deriveCards } from '../derive';
import { fmtNumber } from '../../core/kernel/kernel';
import { IconButton, StateChip } from '../components/widgets';
import { SourceBlock } from '../cells/SourceBlock';
import { PlotSvg } from '../cells/PlotSvg';
import { MarkdownFlow } from '../cells/MarkdownInline';
import { IcArrowUp, IcCheckCircle, IcChevronDown, IcPencil, IcWrench, IcXCircle } from '../components/icons';
import type { RenderCard } from '../derive';
import type { Cell } from '../../core/model/types';

function InlineHeader({ card, onEdit }: { card: RenderCard; onEdit: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: M3.text }}>{card.title}</span>
      <StateChip state={card.state} />
      <div style={{ flex: 1 }} />
      <div
        onClick={onEdit}
        data-testid={`read-edit-${card.cell?.id}`}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: M3.primary, cursor: 'pointer', flexShrink: 0 }}
      >
        <IcPencil size={12} strokeWidth={2} />
        编辑
      </div>
    </div>
  );
}

function SourceFold({ cell, open, onToggle }: { cell?: Cell; open: boolean; onToggle: () => void }) {
  if (cell?.kind.type !== 'code') return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div
        onClick={onToggle}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: M3.textTertiary, cursor: 'pointer' }}
        data-testid={`read-source-toggle-${cell.id}`}
      >
        <div style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s', display: 'flex' }}>
          <IcChevronDown size={12} />
        </div>
        {open ? '隐藏源码' : '查看源码'}
      </div>
      {open && <SourceBlock source={cell.kind.source} />}
    </div>
  );
}

export function ReadView() {
  const { session } = useSession();
  const cards = deriveCards(session);
  const { goMode, selectCell } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [openSource, setOpenSource] = useState<Set<string>>(new Set());

  const toggleSource = (id: string) => setOpenSource((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const edit = (cellId?: string) => {
    if (cellId) selectCell(cellId);
    goMode('calc');
  };

  return (
    <>
      <div
        ref={ref}
        style={{
          position: 'absolute', inset: 0, overflowY: 'auto', padding: '22px 20px 40px',
          boxSizing: 'border-box', maxWidth: 560, margin: '0 auto',
        }}
      >
        {cards.map((card) => {
          switch (card.kind) {
            case 'section':
              return (
                <div key={card.key} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: M3.text, lineHeight: 1.3 }}>{card.title}</div>
                  {card.summary && <div style={{ fontSize: 13, color: M3.textTertiary, marginTop: 4 }}>{card.summary}</div>}
                </div>
              );
            case 'note':
              return (
                <div key={card.key} style={{ marginBottom: 4 }}>
                  <MarkdownFlow source={card.summary} />
                </div>
              );
            case 'compute':
              return (
                <div
                  key={card.key} data-testid={`cell-${card.cell?.id}`}
                  style={{ margin: '20px 0', paddingLeft: 14, borderLeft: `3px solid ${M3.primaryContainer}` }}
                >
                  <InlineHeader card={card} onEdit={() => edit(card.cell?.id)} />
                  <div style={{ fontSize: 21, fontWeight: 700, color: M3.onPrimaryContainer }} data-testid={`read-result-${card.cell?.id}`}>
                    {card.quantity ? `${fmtNumber(card.quantity.value)} ${card.quantity.unit}` : card.bundle?.['text/plain'] ?? '—'}
                  </div>
                  {card.aside && (
                    <div style={{ fontSize: 12, color: M3.textTertiary, marginTop: 2 }}>{card.aside.label} = {card.aside.value}</div>
                  )}
                  <SourceFold cell={card.cell} open={openSource.has(card.cell!.id)} onToggle={() => toggleSource(card.cell!.id)} />
                </div>
              );
            case 'plot':
              return (
                <div
                  key={card.key} data-testid={`cell-${card.cell?.id}`}
                  style={{ margin: '20px 0', paddingLeft: 14, borderLeft: `3px solid ${M3.secondaryContainer}` }}
                >
                  <InlineHeader card={card} onEdit={() => edit(card.cell?.id)} />
                  {card.plot && <div style={{ maxWidth: 360, marginTop: 6 }}><PlotSvg plot={card.plot} height={110} /></div>}
                  <SourceFold cell={card.cell} open={openSource.has(card.cell!.id)} onToggle={() => toggleSource(card.cell!.id)} />
                </div>
              );
            case 'check': {
              const pass = card.check?.pass ?? false;
              return (
                <div
                  key={card.key} data-testid={`cell-${card.cell?.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', padding: '10px 14px',
                    borderRadius: 12, background: pass ? M3.passBg : M3.failBg,
                  }}
                >
                  {pass ? <IcCheckCircle size={17} color={M3.onSuccessContainer} /> : <IcXCircle size={17} color={M3.onErrorContainer} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: M3.text }}>{card.title}</div>
                    <div style={{ fontSize: 12, color: M3.textSecondary }} data-testid={`read-check-${card.cell?.id}`}>{card.check?.message}</div>
                  </div>
                  <div onClick={() => edit(card.cell?.id)} data-testid={`read-edit-${card.cell?.id}`} style={{ cursor: 'pointer', color: M3.textTertiary, display: 'flex', flexShrink: 0 }}>
                    <IcPencil size={14} />
                  </div>
                </div>
              );
            }
            case 'error':
              return (
                <div key={card.key} data-testid={`cell-${card.cell?.id}`} style={{ margin: '16px 0', padding: '12px 14px', borderRadius: 12, background: M3.errorContainer }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IcXCircle size={16} color={M3.onErrorContainer} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: M3.text }}>{card.title}</span>
                    <StateChip state="errored" />
                  </div>
                  <div style={{ fontSize: 12, color: M3.onErrorContainer, marginTop: 4 }}>{card.error?.message ?? '上游错误'}</div>
                  <div
                    onClick={() => edit(card.cell?.id)}
                    style={{
                      marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      borderRadius: 10, background: '#FFFFFF', color: M3.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <IcWrench size={13} />
                    前往修复
                  </div>
                </div>
              );
            case 'placeholder':
              return (
                <div key={card.key} style={{ fontSize: 12.5, color: M3.textTertiary, margin: '12px 0' }}>
                  {card.title} · 占位,即将支持
                </div>
              );
          }
        })}
      </div>

      <div style={{ position: 'absolute', right: 12, bottom: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
        <IconButton size={42} onClick={() => { if (ref.current) ref.current.scrollTop = 0; }} style={{ background: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,.16)' }}>
          <IcArrowUp size={18} color={M3.primary} />
        </IconButton>
      </div>
    </>
  );
}
