// Pending-changes review sheet (spec B5): the user sees what the notebook
// looks like AFTER the change (shadow evaluation), not a text diff.

import { useState } from 'react';
import { M3 } from '../theme';
import { useSession, useStore } from '../store';
import { BottomSheet, Scrim, SheetHeader } from '../components/widgets';
import { IcCheckCircle, IcSparkle, IcXCircle } from '../components/icons';
import type { CellOp } from '../../core/kernel/protocol';

function opTexts(op: CellOp): { label: string; before: string; after: string; reason: string } {
  if (op.t === 'update' || op.t === 'set_param') {
    return {
      label: op.label ?? (op.t === 'update' ? '单元更新' : '参数调整'),
      before: op.before ?? '',
      after: op.afterText ?? '',
      reason: op.reason ?? '',
    };
  }
  if (op.t === 'insert') return { label: '插入单元', before: '—', after: '新单元', reason: '' };
  return { label: '删除单元', before: '现有单元', after: '—', reason: '' };
}

export function PendingSheet() {
  const { pendingOpen, set, resolvePending } = useStore();
  const { session } = useSession();
  const pending = session.pending;
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const [accepted, setAccepted] = useState<Set<number>>(new Set());

  const close = () => {
    set({ pendingOpen: false });
    setRejected(new Set());
    setAccepted(new Set());
  };

  const finishIfDone = (acc: Set<number>, rej: Set<number>) => {
    if (!pending) return;
    if (acc.size + rej.size === pending.ops.length) {
      resolvePending(acc.size === 0 ? 'reject_all' : [...acc]);
      setRejected(new Set());
      setAccepted(new Set());
    }
  };

  // downstream impact preview: real vs shadow outputs for check/quantity cells
  const impacts: { label: string; before: string; after: string }[] = [];
  if (pending) {
    for (const cell of session.notebook.cells) {
      const real = session.outputs.get(cell.id);
      const shadow = pending.shadowOutputs.get(cell.id);
      if (!real || !shadow) continue;
      const before = real['text/plain'];
      const after = shadow['text/plain'];
      if (before !== after && (real['application/vnd.proarch.check+json'] || real['application/vnd.proarch.quantity+json'])) {
        impacts.push({ label: cell.viewHints.calc?.title ?? '计算结果', before, after });
      }
    }
  }

  return (
    <>
      <Scrim open={pendingOpen} onClick={close} />
      <BottomSheet open={pendingOpen} height="68%" testId="pending-sheet">
        <SheetHeader
          icon={<IcSparkle size={19} color={M3.primary} />}
          title={`待确认变更${pending ? ` · ${pending.ops.length}` : ''}`}
          onClose={close}
        />
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!pending && <div style={{ fontSize: 13, color: M3.textTertiary, textAlign: 'center', padding: 24 }}>没有待确认的变更</div>}
          {pending?.ops.map((op, i) => {
            const t = opTexts(op);
            const isAccepted = accepted.has(i);
            const isRejected = rejected.has(i);
            return (
              <div key={i} style={{
                background: M3.surfaceLow, borderRadius: 16, padding: 14,
                opacity: isRejected ? 0.5 : 1,
                border: isAccepted ? `1.5px solid ${M3.primary}` : '1.5px solid transparent',
              }} data-testid={`pending-item-${i}`}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: M3.text }}>{t.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12.5 }}>
                  <span style={{ color: M3.textTertiary, textDecoration: 'line-through' }}>{t.before}</span>
                  <span style={{ color: M3.textFaint }}>→</span>
                  <span style={{ color: M3.onPrimaryContainer, fontWeight: 600 }}>{t.after}</span>
                </div>
                {t.reason && <div style={{ fontSize: 11.5, color: M3.textTertiary, marginTop: 6, lineHeight: 1.4 }}>{t.reason}</div>}
                {!isAccepted && !isRejected && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <div
                      onClick={() => { const acc = new Set(accepted); acc.add(i); setAccepted(acc); finishIfDone(acc, rejected); }}
                      style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: M3.primaryContainer, color: M3.onPrimaryContainer, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                      data-testid={`pending-accept-${i}`}
                    >
                      接受
                    </div>
                    <div
                      onClick={() => { const rej = new Set(rejected); rej.add(i); setRejected(rej); finishIfDone(accepted, rej); }}
                      style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: '#FFFFFF', border: `1px solid ${M3.outline}`, color: M3.textSecondary, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                    >
                      拒绝
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {impacts.length > 0 && (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: M3.textTertiary, marginTop: 6 }}>影响预览(影子求值)</div>
              {impacts.map((im, i) => (
                <div key={i} style={{ background: '#FFFFFF', border: `1px solid ${M3.outline}`, borderRadius: 14, padding: '11px 14px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: M3.text }}>{im.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12 }}>
                    <span style={{ color: M3.textTertiary }}>{im.before}</span>
                    <span style={{ color: M3.textFaint }}>→</span>
                    <span style={{ color: M3.onPrimaryContainer, fontWeight: 600 }} data-testid={`impact-after-${i}`}>{im.after}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {pending && (
          <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '12px 16px 16px', borderTop: `1px solid ${M3.surfaceContainer}` }}>
            <div
              onClick={() => { resolvePending('accept_all'); close(); }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0', borderRadius: 14, background: M3.primary, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
              data-testid="pending-accept-all"
            >
              <IcCheckCircle size={16} color="#fff" />
              全部接受
            </div>
            <div
              onClick={() => { resolvePending('reject_all'); close(); }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0', borderRadius: 14, background: M3.errorContainer, color: M3.onErrorContainer, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
              data-testid="pending-reject-all"
            >
              <IcXCircle size={16} color={M3.onErrorContainer} />
              全部拒绝
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
