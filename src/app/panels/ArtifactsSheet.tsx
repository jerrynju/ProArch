import { M3 } from '../theme';
import { useStore } from '../store';
import { BottomSheet, Scrim, SheetHeader } from '../components/widgets';
import { IcBookmark, IcCode, IcDownload, IcFile, IcPlot } from '../components/icons';

const ARTIFACTS = [
  { name: '挠度曲线.png', sub: '图表 · 2分钟前', icon: <IcPlot size={20} color={M3.onSecondaryContainer} />, bg: M3.secondaryContainer, action: 'notebook' as const },
  { name: '悬臂梁挠度报告.pdf', sub: '导出文档 · 昨天', icon: <IcFile size={20} color={M3.onTertiaryContainer} />, bg: M3.tertiaryContainer, action: 'none' as const },
  { name: 'beam_deflection.m', sub: 'MATLAB 脚本 · 3天前', icon: <IcCode size={20} color={M3.textSecondary} />, bg: '#ECE6F0', action: 'script' as const },
];

export function ArtifactsSheet() {
  const { artifactsOpen, set, exportScript, exportNotebook } = useStore();
  const close = () => set({ artifactsOpen: false });
  return (
    <>
      <Scrim open={artifactsOpen} onClick={close} />
      <BottomSheet open={artifactsOpen} height="65%" testId="artifacts-sheet">
        <SheetHeader icon={<IcBookmark size={19} color={M3.primary} />} title="Artifacts" onClose={close} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ARTIFACTS.map((a) => (
            <div
              key={a.name}
              onClick={() => { if (a.action === 'script') exportScript(); if (a.action === 'notebook') exportNotebook(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: M3.surfaceLow, borderRadius: 14, padding: '12px 14px', cursor: 'pointer' }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {a.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: M3.text }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: M3.textTertiary }}>{a.sub}</div>
              </div>
              <IcDownload size={18} color={M3.textTertiary} />
            </div>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
