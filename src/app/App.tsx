import type { CSSProperties } from 'react';
import { M3, shellTheme } from './theme';
import { useSession, useStore } from './store';
import { SegTab, IconButton, Toast } from './components/widgets';
import {
  IcBookmark, IcCode, IcCopyLink, IcDots, IcDownload, IcHome, IcMenu, IcPrint, IcRobot, IcShare,
} from './components/icons';
import { HomeView } from './views/HomeView';
import { CalcView } from './views/CalcView';
import { FeedView } from './views/FeedView';
import { ReadView } from './views/ReadView';
import { ActionStack } from './panels/ActionStack';
import { AppDrawer } from './panels/AppDrawer';
import { AgentsSheet } from './panels/AgentsSheet';
import { ArtifactsSheet } from './panels/ArtifactsSheet';
import { PendingSheet } from './panels/PendingSheet';
import { InspectSheet } from './panels/InspectSheet';

const BUSY_RING: CSSProperties = {
  position: 'absolute', inset: -3, borderRadius: 25, pointerEvents: 'none',
  background: `conic-gradient(from 0deg, ${M3.primary} 0deg, ${M3.primary} 100deg, transparent 100deg, transparent 360deg)`,
  WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))',
  mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))',
  animation: 'pa-spin 1s linear infinite',
};

function MoreMenu() {
  const { moreMenuOpen, set, exportNotebook, exportScript, showToast } = useStore();
  const entries = [
    { label: '查看 Artifacts', icon: <IcBookmark size={16} color={M3.textSecondary} />, run: () => set({ artifactsOpen: true, moreMenuOpen: false }) },
    { label: '导出为 PDF', icon: <IcDownload size={16} color={M3.textSecondary} />, run: () => { set({ moreMenuOpen: false }); window.print(); } },
    { label: '导出脚本 (.m)', icon: <IcCode size={16} color={M3.textSecondary} />, run: () => { set({ moreMenuOpen: false }); exportScript(); } },
    { label: '导出笔记本 (.pro.md)', icon: <IcDownload size={16} color={M3.textSecondary} />, run: () => { set({ moreMenuOpen: false }); exportNotebook(); } },
    { label: '分享给协作者', icon: <IcShare size={16} color={M3.textSecondary} />, run: () => { set({ moreMenuOpen: false }); showToast('已生成协作链接,可粘贴分享'); } },
    { label: '复制链接', icon: <IcCopyLink size={16} color={M3.textSecondary} />, run: () => { set({ moreMenuOpen: false }); showToast('链接已复制到剪贴板'); } },
    { label: '打印', icon: <IcPrint size={16} color={M3.textSecondary} />, run: () => { set({ moreMenuOpen: false }); window.print(); } },
  ];
  return (
    <div style={{
      position: 'absolute', top: 58, right: 8, zIndex: 50, background: '#FFFFFF', borderRadius: 16,
      boxShadow: '0 8px 24px rgba(0,0,0,.18)', padding: 6, minWidth: 190,
      opacity: moreMenuOpen ? 1 : 0, transform: moreMenuOpen ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(.96)',
      pointerEvents: moreMenuOpen ? 'auto' : 'none', transition: 'opacity .15s, transform .15s', transformOrigin: 'top right',
    }} data-testid="more-menu">
      {entries.map((e) => (
        <div key={e.label} onClick={e.run} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: M3.text }}>
          {e.icon}
          <span>{e.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const { mode, dark, agentBusy, moreMenuOpen, set, goMode } = useStore();
  const { session } = useSession();
  const shell = shellTheme(dark);
  const hasPending = session.pending !== null;

  return (
    <div className="pa-viewport-minh" style={{
      width: '100%', background: dark ? '#0d0c10' : '#ECE6F0',
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      fontFamily: "'Roboto', system-ui, sans-serif",
    }}>
      <div className="pa-viewport-h" style={{
        position: 'relative', width: '100%', maxWidth: 480,
        background: shell.contentBg, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 0 40px rgba(0,0,0,.15)',
      }}>
        {/* app bar */}
        <div style={{
          flexShrink: 0, height: 56, display: 'flex', alignItems: 'center', padding: '0 4px', gap: 2,
          background: shell.surface, borderBottom: `1px solid ${shell.border}`, zIndex: 30,
        }}>
          <IconButton onClick={() => set({ drawerOpen: true, agentsOpen: false, artifactsOpen: false })} testId="menu-btn">
            <IcMenu size={22} color={shell.text} />
          </IconButton>
          <IconButton onClick={() => { goMode('home'); set({ drawerOpen: false }); }} testId="home-btn">
            <IcHome size={22} color={shell.text} />
          </IconButton>
          <div style={{ flex: 1, display: 'flex', background: shell.track, borderRadius: 20, padding: 3, gap: 2, margin: '0 4px' }}>
            <SegTab active={mode === 'feed'} onClick={() => goMode('feed')}>Feed</SegTab>
            <SegTab active={mode === 'read'} onClick={() => goMode('read')}>Read</SegTab>
            <SegTab active={mode === 'calc'} onClick={() => goMode('calc')}>Calc</SegTab>
          </div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <IconButton
              onClick={() => (hasPending
                ? set({ pendingOpen: true, drawerOpen: false, agentsOpen: false, artifactsOpen: false, moreMenuOpen: false })
                : set({ agentsOpen: true, drawerOpen: false, artifactsOpen: false, agentsView: 'list' }))}
              testId="agents-btn"
            >
              <IcRobot size={21} color={shell.text} />
            </IconButton>
            {hasPending && (
              <div data-testid="pending-badge" style={{ position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 5, background: M3.error, boxShadow: `0 0 0 1.5px ${shell.surface}` }} />
            )}
            {agentBusy && <div style={BUSY_RING} />}
          </div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <IconButton onClick={() => set({ moreMenuOpen: !moreMenuOpen })} testId="more-btn">
              <IcDots size={21} color={shell.text} />
            </IconButton>
          </div>
        </div>

        {/* content area */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', overflowAnchor: 'none', background: shell.contentBg }}>
          {mode === 'home' && <HomeView />}
          {mode === 'calc' && (
            <>
              <CalcView shell={shell} />
              <ActionStack />
            </>
          )}
          {mode === 'feed' && <FeedView />}
          {mode === 'read' && <ReadView />}

          {/* more menu scrim + panel */}
          <div
            onClick={() => set({ moreMenuOpen: false })}
            style={{ position: 'absolute', inset: 0, zIndex: 44, display: moreMenuOpen ? 'block' : 'none', background: 'transparent' }}
          />
          <MoreMenu />

          <AppDrawer />
          <AgentsSheet />
          <ArtifactsSheet />
          <PendingSheet />
          <InspectSheet />
          <Toast />
        </div>
      </div>
    </div>
  );
}
