import type { CSSProperties, ReactNode } from 'react';
import { M3 } from '../theme';
import { useSession, useStore } from '../store';
import { fmtNumber } from '../../core/kernel/kernel';
import { IconButton } from '../components/widgets';
import {
  IcArrowDown, IcArrowUp, IcBack, IcBookmark, IcChevronDown, IcChevronUp, IcCopy, IcGear, IcNote,
  IcPlot, IcSparkle, IcTrash, IcTrend, IcSend,
} from '../components/icons';
import { ChatPanel } from './ChatPanel';

function Tile({ label, icon, onClick, active, testId }: { label: string; icon: ReactNode; onClick?: () => void; active?: boolean; testId?: string }) {
  return (
    <div
      onClick={onClick}
      data-testid={testId}
      style={{
        position: 'relative', flex: 1, height: 64, borderRadius: 14,
        background: active ? M3.primaryContainer : '#FFFFFF',
        border: active ? `1.5px solid ${M3.primary}` : '1.5px solid transparent',
        color: M3.primary, cursor: 'pointer', boxSizing: 'border-box',
      }}
    >
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex' }}>{icon}</div>
      <div style={{ position: 'absolute', bottom: 7, left: 9, fontSize: 10.5, fontWeight: 500, color: M3.textSecondary }}>{label}</div>
    </div>
  );
}

function ActTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '7px 14px', borderRadius: 16, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        background: active ? M3.primary : M3.surfaceContainer, color: active ? '#FFFFFF' : M3.textSecondary,
      }}
    >
      {children}
    </div>
  );
}

const SPIN_RING: CSSProperties = {
  position: 'absolute', inset: -3, borderRadius: 17, pointerEvents: 'none',
  background: `conic-gradient(from 0deg, ${M3.primary} 0deg, ${M3.primary} 100deg, transparent 100deg, transparent 360deg)`,
  WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
  mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
  animation: 'pa-spin 1s linear infinite',
};

const COMPUTE_TEMPLATES = [
  { name: '悬臂梁挠度', bg: 'linear-gradient(135deg,#EADDFF,#D0BCFF)', current: true, template: 'let delta = F * 1000.0 * L^3 / (3.0 * (E * 1e9) * (I * 1e-8)) * 1000.0;\nquantity(delta, "mm")' },
  { name: '简支梁弯矩', bg: 'linear-gradient(135deg,#C8E6C9,#8FCB93)', template: 'let M_max = F * L / 4.0;\nquantity(M_max, "kN·m")' },
  { name: '应力校核', bg: 'linear-gradient(135deg,#FFD8E4,#F3A6BE)', template: 'let sigma = F * 1000.0 * L / ((I / 12.5) * 1e-6);\ncheck(sigma <= 235e6, "应力满足限值", "应力超限")' },
  { name: '热传导', bg: 'linear-gradient(135deg,#FFE0B2,#FFB74D)', template: 'let q = 50.0 * (80.0 - 20.0) / 0.2;\nquantity(q, "W/m²")' },
];

const PLOT_TEMPLATES = [
  { name: '折线图', bg: '#EADDFF', svg: <polyline points="8,55 30,30 50,42 92,12" fill="none" stroke="#21005D" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />, template: 'let xs = linspace(0.0, L, 24);\nlet ys = map(xs, |x| x / L);\nplot(xs, ys)' },
  { name: '柱状图', bg: '#E8DEF8', svg: <>{[[10, 35, 30], [32, 20, 45], [54, 45, 20], [76, 10, 55]].map(([x, y, h], i) => <rect key={i} x={x} y={y} width={14} height={h} fill="#4A3B6B" />)}</>, template: 'let xs = [1.0, 2.0, 3.0, 4.0];\nlet ys = [3.0, 5.0, 2.0, 6.0];\nplot(xs, ys, "type=bar")' },
  { name: '散点图', bg: '#FFD8E4', svg: <>{[[18, 45], [35, 25], [52, 50], [68, 18], [85, 35]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill="#5C1130" />)}</>, template: 'let xs = linspace(0.0, 10.0, 12);\nlet ys = map(xs, |x| x * x / 10.0);\nplot(xs, ys, "type=scatter")' },
  { name: '等值线图', bg: 'linear-gradient(135deg,#FFE0B2,#FFB74D,#EF6C00)', template: '// 等值线图即将支持\nlet xs = linspace(0.0, 1.0, 10);\nplot(xs, xs)' },
];

function SubGallery({ kind }: { kind: 'compute' | 'plot' }) {
  const { actionSubExpanded, set, insertSnippet } = useStore();
  const cardStyle: CSSProperties = actionSubExpanded
    ? { position: 'relative', width: 'calc(50% - 4px)', height: 84, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }
    : { position: 'relative', width: 96, height: 78, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', flexShrink: 0 };
  const items = kind === 'compute' ? COMPUTE_TEMPLATES : PLOT_TEMPLATES;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => set({ actionSubView: null, actionSubExpanded: false })} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: M3.primary }} data-testid="sub-back">
          <IcBack size={16} />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>返回</span>
        </div>
        <div style={{ fontSize: 11.5, color: M3.textTertiary }}>{kind === 'compute' ? '选择计算模板' : '选择图表类型'}</div>
        <IconButton size={26} onClick={() => set({ actionSubExpanded: !actionSubExpanded })}>
          <div style={{ transform: actionSubExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', display: 'flex', color: M3.textSecondary }}>
            <IcChevronUp size={16} />
          </div>
        </IconButton>
      </div>
      <div style={actionSubExpanded
        ? { display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginTop: 10 }
        : { display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto' as const }}>
        {items.map((it) => (
          <div key={it.name} style={cardStyle} onClick={() => insertSnippet('code', it.template, it.name)}>
            <div style={{ position: 'absolute', inset: 0, background: it.bg }} />
            {'svg' in it && it.svg && (
              <svg viewBox="0 0 100 70" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>{it.svg}</svg>
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(0,0,0,.4),transparent 55%)' }} />
            {'current' in it && it.current && (
              <div style={{ position: 'absolute', top: 6, left: 7, fontSize: 9, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.25)', padding: '2px 6px', borderRadius: 6 }}>当前</div>
            )}
            <div style={{ position: 'absolute', bottom: 6, left: 8, right: 8, fontSize: 11, fontWeight: 600, color: '#fff' }}>{it.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActionStack() {
  const {
    actionMode, actionExpanded, actionTab, actionSubView, quickParamOpen, chartRunning, agentBusy,
    set, cellAction, insertSnippet, sendPrompt, setParam, selectedCellId,
  } = useStore();
  const { session } = useSession();

  const firstSlider = session.notebook.cells.find((c) => c.kind.type === 'param' && c.kind.control.kind === 'slider');
  const sliderKind = firstSlider?.kind.type === 'param' ? firstSlider.kind : null;
  const sliderCtl = sliderKind?.control.kind === 'slider' ? sliderKind.control : null;

  const stackStyle: CSSProperties = {
    position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 20,
    background: M3.surfaceLow, borderRadius: 24,
    boxShadow: '0 6px 20px rgba(0,0,0,.16), 0 1px 3px rgba(0,0,0,.1)',
    padding: actionMode === 'chat' ? 0 : undefined,
    maxHeight: actionMode === 'chat' ? '78%' : actionSubView ? 280 : undefined,
    height: actionMode === 'chat' ? '62%' : 'auto',
    display: actionMode === 'chat' ? 'flex' : 'block',
    flexDirection: 'column', overflow: 'hidden',
  };

  const tabLabel = actionTab === 'cell' ? '单元操作' : actionTab === 'insert' ? '插入' : 'AI 助手';

  return (
    <div style={stackStyle} data-testid="action-stack">
      {actionMode === 'tools' ? (
        <div style={{ padding: '12px 16px 14px' }}>
          {!actionSubView ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11.5, color: M3.textTertiary, fontWeight: 500 }}>{tabLabel}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div
                    onClick={() => set({ artifactsOpen: true, drawerOpen: false, agentsOpen: false })}
                    style={{
                      position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 16,
                      background: M3.surfaceContainer, color: M3.primary, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                    }}
                    data-testid="artifacts-chip"
                  >
                    <div style={{ position: 'absolute', top: -6, left: -6, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: M3.error, color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</div>
                    <IcBookmark size={15} />
                    <span>Artifacts</span>
                  </div>
                  <IconButton size={30} onClick={() => set({ actionMode: 'chat', actionExpanded: true, actionSubView: null })} testId="open-chat">
                    <IcSparkle size={18} color={M3.primary} />
                  </IconButton>
                  <IconButton size={30} onClick={() => set({ actionExpanded: !actionExpanded })} testId="action-collapse">
                    <div style={{ transform: actionExpanded ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform .2s', display: 'flex', color: M3.textSecondary }}>
                      <IcChevronDown size={18} />
                    </div>
                  </IconButton>
                </div>
              </div>

              {chartRunning && !actionExpanded && (
                <div style={{ height: 3, borderRadius: 2, background: M3.outline, overflow: 'hidden', marginTop: 8 }}>
                  <div style={{ width: '40%', height: '100%', background: M3.primary, borderRadius: 2, animation: 'pa-indet 1.2s ease-in-out infinite' }} />
                </div>
              )}

              {actionExpanded && (
                <div>
                  {actionTab === 'cell' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <Tile label="上移" icon={<IcArrowUp size={18} />} onClick={() => cellAction('move_up')} />
                      <Tile label="下移" icon={<IcArrowDown size={18} />} onClick={() => cellAction('move_down')} />
                      <Tile label="复制" icon={<IcCopy size={18} />} onClick={() => cellAction('duplicate')} testId="tile-duplicate" />
                      <Tile label="删除" icon={<IcTrash size={18} />} onClick={() => cellAction('delete')} testId="tile-delete" />
                    </div>
                  )}
                  {actionTab === 'insert' && (
                    <div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        {sliderKind && sliderCtl && (
                          <div
                            onClick={() => set({ quickParamOpen: !quickParamOpen })}
                            style={{
                              position: 'relative', flex: 1, height: 64, borderRadius: 14,
                              background: quickParamOpen ? M3.primaryContainer : '#FFFFFF',
                              border: quickParamOpen ? `1.5px solid ${M3.primary}` : '1.5px solid transparent',
                              cursor: 'pointer', boxSizing: 'border-box',
                            }}
                            data-testid="quick-param-tile"
                          >
                            <div style={{ position: 'absolute', top: 7, right: 8, textAlign: 'right' }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: M3.onPrimaryContainer, lineHeight: 1 }}>
                                {typeof sliderKind.value === 'number' ? fmtNumber(sliderKind.value) : '—'}
                              </div>
                              <div style={{ fontSize: 8.5, color: M3.textTertiary, marginTop: 2 }}>{sliderCtl.unit ?? ''}</div>
                            </div>
                            <div style={{ position: 'absolute', bottom: 7, left: 9, fontSize: 10.5, fontWeight: 500, color: M3.textSecondary }}>
                              {sliderKind.label ?? sliderKind.name}
                            </div>
                          </div>
                        )}
                        <Tile label="计算" icon={<IcTrend size={18} />} onClick={() => set({ actionSubView: 'compute', actionSubExpanded: false })} testId="insert-compute" />
                        <Tile label="绘图" icon={<IcPlot size={18} />} onClick={() => set({ actionSubView: 'plot', actionSubExpanded: false })} testId="insert-plot" />
                        <Tile label="备注" icon={<IcNote size={18} />} onClick={() => insertSnippet('markdown', '备注内容…')} />
                      </div>
                      {quickParamOpen && sliderKind && sliderCtl && firstSlider && (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${M3.outline}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: M3.textSecondary }}>快捷调整 · {sliderKind.label ?? sliderKind.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: M3.primary }}>
                              {typeof sliderKind.value === 'number' ? `${fmtNumber(sliderKind.value)} ${sliderCtl.unit ?? ''}` : ''}
                            </span>
                          </div>
                          <input
                            type="range" min={sliderCtl.min} max={sliderCtl.max} step={sliderCtl.step}
                            value={typeof sliderKind.value === 'number' ? sliderKind.value : 0}
                            onChange={(e) => setParam(firstSlider.id, Number(e.target.value))}
                            style={{ width: '100%', accentColor: M3.primary }}
                            aria-label="快捷调整"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {actionTab === 'ai' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <Tile label="解释" icon={<IcSparkle size={18} />} onClick={() => { set({ actionMode: 'chat' }); sendPrompt('解释这段计算', { cellId: selectedCellId ?? undefined }); }} testId="ai-explain" />
                      <Tile label="优化" icon={<IcGear size={18} />} onClick={() => { set({ actionMode: 'chat' }); sendPrompt('优化这段计算'); }} />
                      <div style={{ position: 'relative', flex: 1 }}>
                        {chartRunning && <div style={SPIN_RING} />}
                        <Tile label="生成图表" icon={<IcPlot size={18} />} active={chartRunning} onClick={() => set({ chartRunning: !chartRunning })} testId="ai-chart" />
                      </div>
                      <Tile label="提问" icon={<IcSend size={18} />} onClick={() => set({ actionMode: 'chat', actionExpanded: true })} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                    <ActTab active={actionTab === 'cell'} onClick={() => set({ actionTab: 'cell' })}>单元</ActTab>
                    <ActTab active={actionTab === 'insert'} onClick={() => set({ actionTab: 'insert' })}>插入</ActTab>
                    <ActTab active={actionTab === 'ai'} onClick={() => set({ actionTab: 'ai' })}>AI 助手</ActTab>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <SubGallery kind={actionSubView} />
          )}
        </div>
      ) : (
        <ChatPanel busy={agentBusy} />
      )}
    </div>
  );
}
