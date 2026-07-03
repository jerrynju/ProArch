import { useEffect, useRef, type ReactNode } from 'react';
import { M3, type ShellTheme } from '../theme';
import { useSession, useStore } from '../store';
import { deriveCards, type RenderCard } from '../derive';
import { fmtNumber } from '../../core/kernel/kernel';
import type { Cell } from '../../core/model/types';
import { SourceBlock } from '../cells/SourceBlock';
import { ParamControls } from '../cells/ParamControls';
import { PlotSvg, PlotAxisLabels } from '../cells/PlotSvg';
import { StateChip } from '../components/widgets';
import {
  IcAntenna, IcCheckCircle, IcChevronDown, IcNote, IcPackage, IcPencil, IcPlot, IcTable, IcTrend, IcWave, IcWrench, IcXCircle,
} from '../components/icons';
import type { PackageReq } from '../../core/model/types';

function PackageBadges({ packages }: { packages: PackageReq[] }) {
  if (packages.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      {packages.map((p) => (
        <div
          key={p.name}
          data-testid={`pkg-badge-${p.name}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8,
            background: M3.secondaryContainer, color: M3.onSecondaryContainer, fontSize: 11, fontWeight: 600,
          }}
        >
          {p.name === 'rf' ? <IcAntenna size={12} /> : <IcPackage size={12} />}
          <span>{p.name} 域包 {p.version}</span>
        </div>
      ))}
    </div>
  );
}

function CardShell({ card, children }: { card: RenderCard; children: ReactNode }) {
  const sel = useStore((s) => s.selectedCellId);
  const { session } = useSession();
  const pending = !!card.cell && !!session.pending?.ops.some((op) => 'cellId' in op && op.cellId === card.cell!.id);
  // a param cell renders inside its group's compute card, so selecting one
  // (e.g. via the symbol inspector's "go to definer") highlights that card
  const selected = sel !== null && (card.cell?.id === sel || card.paramCells.some((p) => p.id === sel));
  return (
    <div
      data-testid={`cell-${card.cell?.id ?? card.key}`}
      style={{
        background: '#FFFFFF',
        border: pending
          ? `1.5px dashed ${M3.primary}`
          : selected ? `1.5px solid ${M3.primary}` : `1px solid ${M3.outline}`,
        borderRadius: 18, overflow: 'hidden',
        boxShadow: selected && pending ? `0 0 0 3px ${M3.primaryContainer}, 0 1px 2px rgba(0,0,0,.06)` : '0 1px 2px rgba(0,0,0,.06)',
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ card, icon, iconBg, iconColor, expandable }: {
  card: RenderCard; icon: ReactNode; iconBg: string; iconColor: string; expandable?: boolean;
}) {
  const { selectCell, toggleExpand, expanded } = useStore();
  const id = card.cell!.id;
  const isExpanded = expanded[id] ?? true;
  return (
    <div
      onClick={() => { selectCell(id); if (expandable) toggleExpand(id); }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: iconColor }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: M3.text }}>{card.title}</span>
          <StateChip state={card.state} />
        </div>
        <div style={{ fontSize: 12, color: M3.textTertiary, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid={`summary-${id}`}>
          {card.summary}
        </div>
      </div>
      {expandable && (
        <div style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', color: M3.textTertiary, display: 'flex' }}>
          <IcChevronDown size={18} color={M3.textTertiary} />
        </div>
      )}
    </div>
  );
}

function SourceSection({ cell }: { cell: Cell }) {
  const { sourceHidden, toggleSource, selectCell, set } = useStore();
  const hidden = sourceHidden[cell.id];
  if (cell.kind.type !== 'code') return null;

  const openEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectCell(cell.id);
    set({ actionMode: 'tools', actionTab: 'cell', actionExpanded: true, actionSubView: null });
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, background: M3.codeBg,
        borderRadius: hidden ? 12 : '12px 12px 0 0', padding: '8px 12px',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: M3.codeComment, letterSpacing: '.04em' }}>源码 · rhai</span>
        <div style={{ flex: 1 }} />
        <div
          onClick={openEditor}
          data-testid={`edit-source-${cell.id}`}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#fff', opacity: 0.85, cursor: 'pointer' }}
        >
          <IcPencil size={12} strokeWidth={2} />
          编辑
        </div>
        <div
          onClick={(e) => { e.stopPropagation(); toggleSource(cell.id); }}
          style={{ fontSize: 10.5, color: '#fff', opacity: 0.85, cursor: 'pointer' }}
        >
          {hidden ? '显示' : '隐藏'}
        </div>
      </div>
      {!hidden && <SourceBlock source={cell.kind.source} flushTop />}
    </div>
  );
}

/**
 * Wolfram-notebook-style dependency strip: the free symbols this cell reads,
 * shown as tappable chips. Notebook symbols carry their live value; domain
 * package functions carry the package tag. Tapping opens the inspect sheet
 * (kernel `inspect` op). Same underlying DAG facts in every view — this is
 * just the Calc projection of them.
 */
function SymbolChips({ card }: { card: RenderCard }) {
  const set = useStore((s) => s.set);
  const { session } = useSession();
  const { userSyms, pkgFns } = session.symbolsOf(card.cell!.id);
  const closures = session.closuresOf(card.cell!.id);
  if (userSyms.length === 0 && pkgFns.length === 0 && closures.length === 0) return null;
  const chipBase = {
    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 8,
    fontSize: 11, fontFamily: "ui-monospace,'SFMono-Regular',Consolas,monospace",
    cursor: 'pointer', flexShrink: 0,
  } as const;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: M3.textTertiary, letterSpacing: '.03em', marginBottom: 6 }}>依赖符号</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {userSyms.map((s) => {
          const v = session.currentValue(s);
          const val = typeof v === 'number' ? fmtNumber(v)
            : v && typeof v === 'object' && !Array.isArray(v) && v.kind === 'quantity' ? fmtNumber(v.value)
            : null;
          return (
            <div key={s} onClick={() => set({ inspectSymbol: s })} data-testid={`sym-chip-${s}`}
              style={{ ...chipBase, background: M3.surfaceContainer, color: M3.textSecondary }}>
              <span style={{ color: M3.primary, fontWeight: 600 }}>{s}</span>
              {val !== null && <span>= {val}</span>}
            </div>
          );
        })}
        {pkgFns.map((s) => (
          <div key={s} onClick={() => set({ inspectSymbol: s })} data-testid={`sym-chip-${s}`}
            style={{ ...chipBase, background: M3.secondaryContainer, color: M3.onSecondaryContainer }}>
            <span style={{ fontWeight: 600 }}>{s}()</span>
            <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(0,0,0,.08)', borderRadius: 4, padding: '1px 4px' }}>域包</span>
          </div>
        ))}
        {closures.map((s) => (
          <div key={s} onClick={() => set({ inspectSymbol: s })} data-testid={`def-chip-${s}`}
            style={{ ...chipBase, background: M3.tertiaryContainer, color: M3.onTertiaryContainer }}>
            <span style={{ fontWeight: 600 }}>ƒ {s}</span>
            <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(0,0,0,.08)', borderRadius: 4, padding: '1px 4px' }}>本单元定义</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComputeCard({ card }: { card: RenderCard }) {
  const expanded = useStore((s) => s.expanded)[card.cell!.id] ?? true;
  return (
    <CardShell card={card}>
      <CardHeader card={card} icon={<IcTrend size={18} strokeWidth={1.9} />} iconBg={M3.primaryContainer} iconColor={M3.onPrimaryContainer} expandable />
      {expanded && (
        <div style={{ padding: '2px 16px 18px', borderTop: `1px solid ${M3.surfaceContainer}` }}>
          <SourceSection cell={card.cell!} />
          <SymbolChips card={card} />
          <ParamControls params={card.paramCells} />
          <div style={{ marginTop: 16, background: M3.surfaceContainer, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11.5, color: M3.textTertiary }}>{card.title.replace('计算', '')}结果</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: M3.onPrimaryContainer, lineHeight: 1.2 }} data-testid={`result-${card.cell!.id}`}>
                {card.quantity ? `${fmtNumber(card.quantity.value)} ${card.quantity.unit}` : card.bundle?.['text/plain'] ?? '—'}
              </div>
            </div>
            {card.aside && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: M3.textTertiary }}>{card.aside.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: M3.textSecondary }} data-testid={`aside-${card.cell!.id}`}>{card.aside.value}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </CardShell>
  );
}

function PlotCard({ card }: { card: RenderCard }) {
  const expanded = useStore((s) => s.expanded)[card.cell!.id] ?? true;
  return (
    <CardShell card={card}>
      <CardHeader card={card} icon={<IcPlot size={18} />} iconBg={M3.secondaryContainer} iconColor={M3.onSecondaryContainer} expandable />
      {expanded && (
        <div style={{ padding: '4px 16px 18px', borderTop: `1px solid ${M3.surfaceContainer}` }}>
          <SourceSection cell={card.cell!} />
          <SymbolChips card={card} />
          {card.plot && (
            <div style={{ marginTop: 10 }}>
              <PlotSvg plot={card.plot} />
              <PlotAxisLabels plot={card.plot} />
            </div>
          )}
        </div>
      )}
    </CardShell>
  );
}

function CheckCard({ card }: { card: RenderCard }) {
  const pass = card.check?.pass ?? false;
  const selectCell = useStore((s) => s.selectCell);
  return (
    <div
      data-testid={`cell-${card.cell!.id}`}
      onClick={() => selectCell(card.cell!.id)}
      style={{
        background: pass ? M3.passBg : M3.failBg,
        border: `1px solid ${pass ? M3.successContainer : M3.errorContainer}`,
        borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: pass ? M3.successContainer : M3.errorContainer,
      }}>
        {pass ? <IcCheckCircle size={18} color={M3.onSuccessContainer} /> : <IcXCircle size={18} color={M3.onErrorContainer} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: M3.text }}>{card.title}</div>
        <div style={{ fontSize: 12, marginTop: 1, color: M3.textSecondary }} data-testid={`check-${card.cell!.id}`}>{card.check?.message}</div>
      </div>
    </div>
  );
}

function ErrorCard({ card }: { card: RenderCard }) {
  const { selectCell, sendPrompt, set, loadPackage } = useStore();
  const { session } = useSession();
  const err = card.error;
  // capability-gap self-healing: the registry knows a package providing the
  // missing symbol — offer to attach it right on the error card
  const suggestion = session.suggestionFor(card.cell!.id);
  return (
    <CardShell card={card}>
      <div onClick={() => selectCell(card.cell!.id)} style={{ padding: '14px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: M3.errorContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IcXCircle size={18} color={M3.onErrorContainer} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: M3.text }}>{card.title}</span>
              <StateChip state={card.state} />
            </div>
            <div style={{ fontSize: 12, color: M3.onErrorContainer, marginTop: 1 }}>{err?.message ?? '上游错误'}</div>
          </div>
        </div>
        {err?.hint && (
          <div style={{ marginTop: 10, fontSize: 12, color: M3.textSecondary, background: M3.surfaceLow, borderRadius: 10, padding: '9px 12px' }}>
            💡 {err.hint}
          </div>
        )}
        {suggestion && (
          <div style={{
            marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
            borderRadius: 10, background: M3.secondaryContainer,
          }}>
            <span style={{ fontSize: 12, color: M3.onSecondaryContainer, flex: 1, minWidth: 0 }}>
              <code style={{ fontFamily: "ui-monospace,Consolas,monospace" }}>{suggestion.symbol}</code>
              {' '}由 <b>{suggestion.pkg.name}</b> 域包提供
            </span>
            <div
              data-testid="pkg-suggestion-btn"
              onClick={(e) => { e.stopPropagation(); loadPackage(suggestion.pkg.name); }}
              style={{
                flexShrink: 0, padding: '5px 12px', borderRadius: 10, background: M3.primary,
                color: '#FFFFFF', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              }}
            >
              加载并重算
            </div>
          </div>
        )}
        {err && (
          <div
            data-testid="fix-error-btn"
            onClick={(e) => {
              e.stopPropagation();
              selectCell(card.cell!.id);
              set({ actionMode: 'chat', actionExpanded: true, actionSubView: null });
              sendPrompt('修复该错误', { cellId: card.cell!.id });
            }}
            style={{
              marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 12, background: M3.primaryContainer, color: M3.onPrimaryContainer,
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <IcWrench size={14} />
            修复错误
          </div>
        )}
      </div>
    </CardShell>
  );
}

function PlaceholderCard({ card }: { card: RenderCard }) {
  const isTable = card.cell?.viewHints.calc?.icon === 'table';
  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${M3.outline}`, borderRadius: 18, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isTable ? 10 : 0 }}>
        {isTable ? <IcTable size={18} color={M3.textSecondary} /> : <IcWave size={18} color={M3.textSecondary} />}
        <div style={{ fontSize: 14.5, fontWeight: 600, color: M3.text, flex: 1 }}>{card.title}</div>
        <div style={{ fontSize: 10.5, color: M3.textTertiary, background: M3.surfaceContainer, padding: '3px 8px', borderRadius: 8 }}>占位</div>
      </div>
      {isTable ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 10, borderRadius: 5, background: M3.surfaceContainer, width: '100%' }} />
          <div style={{ height: 10, borderRadius: 5, background: M3.surfaceContainer, width: '88%' }} />
          <div style={{ height: 10, borderRadius: 5, background: M3.surfaceContainer, width: '70%' }} />
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: M3.textTertiary, marginTop: 1 }}>占位 · 即将支持</div>
      )}
    </div>
  );
}

export function CalcView({ shell }: { shell: ShellTheme }) {
  const { session } = useSession();
  const cards = deriveCards(session);
  const toolbarHeight = useStore((s) => s.toolbarHeight);
  const ref = useRef<HTMLDivElement>(null);

  // Cross-projection continuity: arriving from Feed/Read (or the symbol
  // inspector) with a cell selected, land on that cell's card — the same
  // cell, just re-projected. Param cells resolve to their group card.
  useEffect(() => {
    const sel = useStore.getState().selectedCellId;
    if (!sel || !ref.current) return;
    const card = cards.find((c) => c.cell?.id === sel || c.paramCells.some((p) => p.id === sel));
    if (!card) return;
    const el = ref.current.querySelector(`[data-testid="cell-${card.cell?.id ?? card.key}"]`) as HTMLElement | null;
    if (el) ref.current.scrollTop = Math.max(0, el.offsetTop - 72);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="pa-card-list" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: `16px 14px ${toolbarHeight}px`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {cards.map((card) => {
        switch (card.kind) {
          case 'section':
            return (
              <div key={card.key} style={{ padding: '6px 4px 0' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: shell.text }}>{card.title}</div>
                <div style={{ fontSize: 12.5, color: shell.textSecondary, marginTop: 2 }}>{card.summary}</div>
                <PackageBadges packages={session.notebook.meta.packages} />
              </div>
            );
          case 'note':
            return (
              <div key={card.key} style={{ background: M3.surfaceLow, borderRadius: 16, padding: '14px 16px', display: 'flex', gap: 10 }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}><IcNote size={18} color={M3.textTertiary} /></span>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: M3.textSecondary }}>{card.summary}</div>
              </div>
            );
          case 'compute': return <ComputeCard key={card.key} card={card} />;
          case 'plot': return <PlotCard key={card.key} card={card} />;
          case 'check': return <CheckCard key={card.key} card={card} />;
          case 'error': return <ErrorCard key={card.key} card={card} />;
          case 'placeholder': return <PlaceholderCard key={card.key} card={card} />;
        }
      })}
    </div>
  );
}
