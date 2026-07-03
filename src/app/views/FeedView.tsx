import { useCallback, useEffect, useRef } from 'react';
import { M3 } from '../theme';
import { NOTEBOOK_FILES, useSession, useStore } from '../store';
import { deriveCards, type RenderCard } from '../derive';
import { fmtNumber } from '../../core/kernel/kernel';
import { PlotSvg } from '../cells/PlotSvg';
import { ParamControls } from '../cells/ParamControls';
import { ComingSoonTag, disabledStyle, SegTab, IconButton, StateChip, ToolbarShell } from '../components/widgets';
import { useMeasuredHeight } from '../hooks/useMeasuredHeight';
import {
  IcBookmark, IcCheckCircle, IcChevronUp, IcClose, IcCode, IcDots, IcGrid, IcNote, IcSparkle, IcTable, IcWave, IcXCircle,
} from '../components/icons';

/** TikTok-style per-card CTA: jump to the same cell's Calc projection. */
function EditInCalc({ card }: { card: RenderCard }) {
  const { goMode, selectCell } = useStore();
  if (!card.cell || !(card.kind === 'compute' || card.kind === 'plot' || card.kind === 'error' || card.kind === 'check')) return null;
  return (
    <div
      data-testid="feed-edit-in-calc"
      onClick={() => { selectCell(card.cell!.id); goMode('calc'); }}
      style={{
        marginTop: 22, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
        borderRadius: 14, background: M3.primaryContainer, color: M3.onPrimaryContainer,
        fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      }}
    >
      <IcCode size={14} />
      在 Calc 中编辑
    </div>
  );
}

function FeedPage({ card }: { card: RenderCard }) {
  const base: React.CSSProperties = {
    height: '100%', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box', textAlign: 'center',
  };
  switch (card.kind) {
    case 'section':
      return (
        <div style={base}>
          <div style={{ fontSize: 28, fontWeight: 700, color: M3.text }}>{card.title}</div>
          <div style={{ fontSize: 14, color: M3.textTertiary, marginTop: 8 }}>{card.summary}</div>
        </div>
      );
    case 'note':
      return (
        <div style={{ ...base, padding: 32 }}>
          <span style={{ marginBottom: 16 }}><IcNote size={40} color={M3.textTertiary} strokeWidth={1.6} /></span>
          <div style={{ fontSize: 15, lineHeight: 1.7, color: M3.textSecondary, maxWidth: 280 }}>{card.summary}</div>
        </div>
      );
    case 'compute':
      return (
        <div style={base}>
          <div style={{ fontSize: 13, color: M3.textTertiary, marginBottom: 10 }}>{card.title}</div>
          <div style={{ fontSize: 52, fontWeight: 700, color: M3.onPrimaryContainer }} data-testid="feed-result">
            {card.quantity ? `${fmtNumber(card.quantity.value)} ${card.quantity.unit}` : card.bundle?.['text/plain']}
          </div>
          <div style={{ fontSize: 13, color: M3.textSecondary, marginTop: 14 }}>{card.summary}</div>
          {card.aside && (
            <div style={{ marginTop: 18, background: M3.surfaceContainer, borderRadius: 16, padding: '16px 20px', fontSize: 13, color: M3.textSecondary }}>
              {card.aside.label} = {card.aside.value}
            </div>
          )}
          {card.paramCells.length > 0 && (
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ marginTop: 22, width: '100%', maxWidth: 280, textAlign: 'left', background: '#FFFFFF', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}
            >
              <ParamControls params={card.paramCells} compact />
            </div>
          )}
          <EditInCalc card={card} />
        </div>
      );
    case 'plot':
      return (
        <div style={base}>
          <div style={{ fontSize: 15, fontWeight: 600, color: M3.text, marginBottom: 14 }}>{card.title}</div>
          {card.plot && <div style={{ width: 260 }}><PlotSvg plot={card.plot} strokeWidth={3} height={102} /></div>}
          <div style={{ fontSize: 12.5, color: M3.textTertiary, marginTop: 10 }}>{card.summary}</div>
          <EditInCalc card={card} />
        </div>
      );
    case 'check': {
      const pass = card.check?.pass ?? false;
      return (
        <div style={base}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: pass ? M3.successContainer : M3.errorContainer,
          }}>
            {pass ? <IcCheckCircle size={30} color={M3.onSuccessContainer} strokeWidth={2} /> : <IcXCircle size={30} color={M3.onErrorContainer} strokeWidth={2} />}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: M3.text, marginTop: 16 }}>{card.title}</div>
          <div style={{ fontSize: 13, color: M3.textSecondary, marginTop: 4 }} data-testid="feed-check">{card.check?.message}</div>
          {card.paramCells.length > 0 && (
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ marginTop: 22, width: '100%', maxWidth: 280, textAlign: 'left', background: '#FFFFFF', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}
            >
              <ParamControls params={card.paramCells} compact />
            </div>
          )}
          <EditInCalc card={card} />
        </div>
      );
    }
    case 'error':
      return (
        <div style={base}>
          <div style={{ width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: M3.errorContainer }}>
            <IcXCircle size={30} color={M3.onErrorContainer} strokeWidth={2} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: M3.text, marginTop: 16 }}>{card.title}</div>
          <div style={{ fontSize: 13, color: M3.onErrorContainer, marginTop: 4, maxWidth: 280 }}>{card.error?.message}</div>
          <div style={{ marginTop: 8 }}><StateChip state="errored" /></div>
          <EditInCalc card={card} />
        </div>
      );
    case 'placeholder':
      return (
        <div style={base}>
          {card.cell?.viewHints.calc?.icon === 'table'
            ? <IcTable size={34} color={M3.textTertiary} strokeWidth={1.6} />
            : <IcWave size={34} color={M3.textTertiary} strokeWidth={1.6} />}
          <div style={{ fontSize: 15, fontWeight: 600, color: M3.text, marginTop: 14 }}>{card.title}</div>
          <div style={{ fontSize: 11.5, color: M3.textTertiary, background: M3.surfaceContainer, padding: '4px 10px', borderRadius: 8, marginTop: 8 }}>
            占位 · 即将支持
          </div>
        </div>
      );
  }
}

export function FeedView() {
  const { session } = useSession();
  const cards = deriveCards(session);
  const {
    feedIndex, feedOverview, feedActionMenuOpen, feedHintSeen, notebookPath, toolbarHeight, set, goMode, selectCell,
  } = useStore();
  const fileName = NOTEBOOK_FILES.find((f) => f.path === notebookPath)?.fileName ?? session.notebook.meta.title;
  const ref = useRef<HTMLDivElement>(null);
  const measureRef = useMeasuredHeight<HTMLDivElement>(
    useCallback((h) => useStore.setState({ toolbarHeight: h + 24 }), []),
  );

  // when entering feed with a selected cell, jump to its card
  const selectedCellId = useStore((s) => s.selectedCellId);
  useEffect(() => {
    const idx = cards.findIndex((c) => c.cell?.id === selectedCellId);
    if (idx >= 0 && ref.current) {
      ref.current.scrollTop = idx * ref.current.clientHeight;
      set({ feedIndex: idx });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const h = e.currentTarget.clientHeight || 1;
    const idx = Math.max(0, Math.min(cards.length - 1, Math.round(e.currentTarget.scrollTop / h)));
    if (!feedHintSeen && e.currentTarget.scrollTop > 40) set({ feedHintSeen: true });
    if (idx !== feedIndex) {
      const cellId = cards[idx]?.cell?.id;
      set({ feedIndex: idx });
      if (cellId) selectCell(cellId);
    }
  };

  const jumpTo = (i: number) => {
    set({ feedOverview: false, feedIndex: i });
    const cellId = cards[i]?.cell?.id;
    if (cellId) selectCell(cellId);
    requestAnimationFrame(() => {
      if (ref.current) ref.current.scrollTop = i * ref.current.clientHeight;
    });
  };

  return (
    <>
      <div ref={ref} onScroll={onScroll} data-testid="feed-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', scrollSnapType: 'y mandatory' }}>
        {cards.map((card) => <FeedPage key={card.key} card={card} />)}
      </div>

      {/* TikTok-style position badge: which file, which card — makes it
          obvious the feed is a projection of one document, not a stream */}
      <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 14, pointerEvents: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 10,
          background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(6px)', minWidth: 0,
          fontSize: 11, fontWeight: 600, color: M3.textSecondary, boxShadow: '0 1px 4px rgba(0,0,0,.08)',
        }} data-testid="feed-file-badge">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 10,
          background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(6px)', flexShrink: 0,
          fontSize: 11, fontWeight: 600, color: M3.textSecondary, boxShadow: '0 1px 4px rgba(0,0,0,.08)',
        }} data-testid="feed-index-badge">
          <span style={{ color: M3.primary }}>{feedIndex + 1}/{cards.length}</span>
          <span>· {cards[feedIndex]?.overviewLabel ?? ''}</span>
        </div>
      </div>

      {/* first-run swipe hint (fades after the first scroll) */}
      {!feedHintSeen && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: toolbarHeight + 16, zIndex: 14,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }} data-testid="feed-swipe-hint">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 14,
            background: 'rgba(29,27,32,.72)', color: '#F5EEFF', fontSize: 11.5, fontWeight: 500,
          }}>
            <span style={{ display: 'flex', animation: 'pa-bob 1.2s ease-in-out infinite' }}>
              <IcChevronUp size={14} color="#F5EEFF" />
            </span>
            上滑浏览下一张卡片
          </div>
        </div>
      )}

      {feedOverview && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(28,27,31,.75)', zIndex: 25, padding: '20px 16px', boxSizing: 'border-box', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>全部卡片概览</span>
            <IconButton size={30} onClick={() => set({ feedOverview: false })} style={{ background: 'rgba(255,255,255,.15)' }}>
              <IcClose size={16} color="#fff" />
            </IconButton>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {cards.map((card, i) => (
              <div
                key={card.key}
                onClick={() => jumpTo(i)}
                style={{
                  borderRadius: 14, padding: 12, cursor: 'pointer', minHeight: 76,
                  background: i === feedIndex ? M3.primaryContainer : '#FFFFFF',
                  border: i === feedIndex ? `1.5px solid ${M3.primary}` : '1.5px solid transparent',
                }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 700, color: i === feedIndex ? M3.primary : M3.textFaint, marginBottom: 4 }}>
                  {i + 1} · {card.overviewLabel}
                </div>
                <div style={{
                  fontSize: 12, color: M3.text, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                }}>
                  {card.summary || card.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* priority quick actions — float just above the toolbar, never over it */}
      <div style={{ position: 'absolute', right: 12, bottom: toolbarHeight + 12, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 16 }}>
        <IconButton onClick={() => set({ artifactsOpen: true, drawerOpen: false, agentsOpen: false })} style={{ background: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,.18)' }}>
          <IcBookmark size={19} color={M3.primary} />
        </IconButton>
        <IconButton onClick={() => { goMode('calc'); set({ actionMode: 'chat', actionExpanded: true, actionSubView: null }); }} style={{ background: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,.18)' }}>
          <IcSparkle size={18} color={M3.primary} />
        </IconButton>
        <div style={{ position: 'relative' }}>
          <IconButton onClick={() => set({ feedActionMenuOpen: !feedActionMenuOpen })} style={{ background: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,.18)' }}>
            <IcDots size={19} color={M3.textSecondary} />
          </IconButton>
          {feedActionMenuOpen && (
            <div style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: 8, background: '#FFFFFF', borderRadius: 14, boxShadow: '0 6px 20px rgba(0,0,0,.2)', padding: 6, minWidth: 160 }}>
              {([
                { label: '添加批注' },
                { label: '分享该卡片', run: () => { set({ feedActionMenuOpen: false }); useStore.getState().shareNotebook(); } },
                { label: '导出为图片' },
              ] as { label: string; run?: () => void }[]).map((t) => (
                <div
                  key={t.label}
                  onClick={t.run}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', fontSize: 12.5, color: M3.text, borderRadius: 8, whiteSpace: 'nowrap', cursor: t.run ? 'pointer' : 'not-allowed', ...(t.run ? null : disabledStyle) }}
                >
                  <span style={{ flex: 1 }}>{t.label}</span>
                  {!t.run && <ComingSoonTag />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* bottom toolbar — same floating-card shell as Calc's action stack */}
      <ToolbarShell testId="feed-toolbar" style={{ padding: '12px 16px 14px' }}>
        <div ref={measureRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconButton size={26} onClick={() => set({ feedOverview: !feedOverview })} testId="feed-overview-btn">
              <IcGrid size={15} color={M3.primary} />
            </IconButton>
            <div style={{ display: 'flex', gap: 6 }}>
              {cards.map((c, i) => (
                <div key={c.key} style={{ width: 6, height: 6, borderRadius: 3, background: i === feedIndex ? M3.primary : M3.outlineDim }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', background: M3.surfaceContainer, borderRadius: 20, padding: 3, gap: 2, width: '100%' }}>
            <SegTab active onClick={() => {}}>Feed</SegTab>
            <SegTab active={false} onClick={() => goMode('read')}>Read</SegTab>
            <SegTab active={false} onClick={() => goMode('calc')}>Calc</SegTab>
          </div>
        </div>
      </ToolbarShell>
    </>
  );
}
