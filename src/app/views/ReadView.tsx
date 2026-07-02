import { useRef } from 'react';
import { M3 } from '../theme';
import { useSession, useStore } from '../store';
import { deriveCards } from '../derive';
import { IconButton } from '../components/widgets';
import { IcArrowUp, IcChevronDown, IcChevronRight } from '../components/icons';

export function ReadView() {
  const { session } = useSession();
  const cards = deriveCards(session);
  const { readCollapsed, set, goMode, selectCell } = useStore();
  const ref = useRef<HTMLDivElement>(null);

  const enterEdit = (cellId?: string) => {
    if (cellId) selectCell(cellId);
    goMode('calc');
  };

  return (
    <>
      <div ref={ref} style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '18px 16px 30px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {cards.map((card) => {
          if (card.kind === 'section') {
            return <div key={card.key} style={{ fontSize: 20, fontWeight: 700, color: M3.text, padding: '6px 4px 14px' }}>{card.title}</div>;
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
          return (
            <div
              key={card.key}
              onClick={clickable ? () => enterEdit(card.cell?.id) : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '14px 4px',
                borderBottom: `1px solid ${M3.surfaceContainer}`, cursor: clickable ? 'pointer' : 'default',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: M3.text }}>{card.title}</div>
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

      <div style={{ position: 'absolute', right: 12, bottom: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
        <IconButton size={42} onClick={() => { if (ref.current) ref.current.scrollTop = 0; }} style={{ background: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,.16)' }}>
          <IcArrowUp size={18} color={M3.primary} />
        </IconButton>
        <IconButton size={42} onClick={() => set({ readCollapsed: !readCollapsed })} style={{ background: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,.16)' }} testId="read-collapse">
          <div style={{ transform: readCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', display: 'flex' }}>
            <IcChevronDown size={18} color={M3.textSecondary} />
          </div>
        </IconButton>
      </div>
    </>
  );
}
