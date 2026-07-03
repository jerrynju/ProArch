import type { CSSProperties, ReactNode } from 'react';
import { M3 } from '../theme';
import { useStore } from '../store';
import { IcCheckCircle } from './icons';

export function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 40, height: 24, borderRadius: 12, background: on ? M3.primary : M3.outlineDim,
        position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .15s',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: on ? 19 : 3, width: 18, height: 18, borderRadius: 9,
        background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,.3)', transition: 'left .15s',
      }} />
    </div>
  );
}

export function Chip({ active, onClick, children, flex = true }: { active: boolean; onClick?: () => void; children: ReactNode; flex?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: flex ? 1 : undefined, textAlign: 'center', padding: '9px 12px', borderRadius: 12, fontSize: 12,
        fontWeight: 500, cursor: 'pointer',
        border: active ? `1.5px solid ${M3.primary}` : `1.5px solid ${M3.outline}`,
        background: active ? M3.primaryContainer : '#FFFFFF',
        color: active ? M3.onPrimaryContainer : M3.textSecondary,
      }}
    >
      {children}
    </div>
  );
}

export function SegTab({ active, onClick, children }: { active: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 18,
        fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background .15s, color .15s',
        background: active ? M3.primaryContainer : 'transparent',
        color: active ? M3.onPrimaryContainer : M3.textSecondary,
      }}
    >
      {children}
    </div>
  );
}

const STATE_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  ok: { bg: M3.successContainer, color: M3.onSuccessContainer, label: '已完成' },
  running: { bg: M3.primaryContainer, color: '#4A3B6B', label: '运行中' },
  queued: { bg: M3.primaryContainer, color: '#4A3B6B', label: '排队中' },
  errored: { bg: M3.errorContainer, color: M3.onErrorContainer, label: '错误' },
  blocked: { bg: M3.surfaceContainer, color: M3.textTertiary, label: '上游错误' },
  stale: { bg: M3.surfaceContainer, color: M3.textTertiary, label: '待更新' },
  placeholder: { bg: M3.surfaceContainer, color: M3.textTertiary, label: '待支持' },
  pending: { bg: M3.primaryContainer, color: '#4A3B6B', label: '待确认' },
};

/** Small "coming soon" tag for stub controls that have no real handler yet. */
export function ComingSoonTag() {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, color: M3.textTertiary, background: M3.surfaceContainer,
      padding: '2px 7px', borderRadius: 7, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      即将支持
    </span>
  );
}

/** Style patch applied to any disabled/stub control: dims it and swaps the cursor. */
export const disabledStyle: CSSProperties = { opacity: 0.45, cursor: 'not-allowed' };

export function StateChip({ state }: { state: string }) {
  const m = STATE_CHIP[state] ?? STATE_CHIP.ok;
  return (
    <div style={{
      display: 'inline-block', fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 7,
      background: m.bg, color: m.color, flexShrink: 0,
    }}>
      {m.label}
    </div>
  );
}

export function IconButton({ onClick, size = 44, children, style, testId }: {
  onClick?: (e: React.MouseEvent) => void; size?: number; children: ReactNode; style?: CSSProperties; testId?: string;
}) {
  return (
    <div
      onClick={onClick}
      data-testid={testId}
      style={{
        width: size, height: size, borderRadius: size / 2, display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer', flexShrink: 0, ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Shared floating-card shell for the bottom toolbar in all three notebook
 * views (Calc/Feed/Read) — one visual language (surface, radius, elevation,
 * side margins) so the panel doesn't look like three unrelated widgets
 * depending on which mode you're in.
 */
export function ToolbarShell({ children, style, testId }: { children: ReactNode; style?: CSSProperties; testId?: string }) {
  return (
    <div
      data-testid={testId}
      style={{
        position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 20,
        background: M3.surfaceLow, borderRadius: 24,
        boxShadow: '0 6px 20px rgba(0,0,0,.16), 0 1px 3px rgba(0,0,0,.1)',
        overflow: 'hidden', boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Scrim({ open, onClick, z = 45, bottomInset = 0 }: { open: boolean; onClick: () => void; z?: number; bottomInset?: number }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: bottomInset, background: 'rgba(0,0,0,.32)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', zIndex: z,
        display: open ? 'block' : 'none',
      }}
    />
  );
}

export function BottomSheet({ open, height = '70%', children, testId }: { open: boolean; height?: string; children: ReactNode; testId?: string }) {
  // The parked (closed) sheet is clipped by a zero-overflow wrapper so the
  // content area never gains scrollable overflow — otherwise browser-driven
  // scrolling (click scroll-into-view, scroll anchoring) can silently scroll
  // the overflow-hidden content area and shift every bottom-anchored layer.
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 46 }}>
      <div
        data-testid={testId}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height, background: '#FFFFFF',
          borderRadius: '20px 20px 0 0', boxShadow: '0 -6px 24px rgba(0,0,0,.2)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          pointerEvents: open ? 'auto' : 'none',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          visibility: open ? 'visible' : 'hidden',
          transition: 'transform .22s ease, visibility .22s',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ icon, title, onClose, extra }: { icon: ReactNode; title: string; onClose: () => void; extra?: ReactNode }) {
  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${M3.surfaceContainer}`, gap: 10 }}>
      {icon}
      <div style={{ fontSize: 15, fontWeight: 600, color: M3.text, flex: 1 }}>{title}</div>
      {extra}
      <IconButton size={32} onClick={onClose} testId="sheet-close">
        <span style={{ color: M3.textSecondary, display: 'flex' }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
        </span>
      </IconButton>
    </div>
  );
}

export function SliderRow({ label, display, min, max, step, value, onChange, compact }: {
  label: string; display: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; compact?: boolean;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: compact ? '0 0 4px' : '14px 0 4px' }}>
        <span style={{ fontSize: 12.5, color: M3.textSecondary }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: M3.primary }} data-testid={`param-display-${label}`}>{display}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: M3.primary, margin: 0 }}
      />
    </div>
  );
}

/**
 * Global confirmation toast. Actions like "export" or "share" used to fire
 * silently (a file just appeared in the downloads folder with no on-screen
 * acknowledgement) — this gives every such action a visible result. Sits
 * above the bottom toolbar in every mode so it's never the thing being
 * covered.
 */
export function Toast() {
  const toast = useStore((s) => s.toast);
  const toolbarHeight = useStore((s) => s.toolbarHeight);
  return (
    <div
      data-testid="toast"
      style={{
        position: 'absolute', left: 16, right: 16, bottom: toolbarHeight + 22, zIndex: 60,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%',
          background: '#332D41', color: '#F5EEFF', borderRadius: 14, padding: '10px 16px',
          fontSize: 12.5, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,.28)',
          opacity: toast ? 1 : 0, transform: toast ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity .18s, transform .18s',
        }}
      >
        <IcCheckCircle size={15} color="#B69DF8" />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toast?.message ?? ''}</span>
      </div>
    </div>
  );
}
