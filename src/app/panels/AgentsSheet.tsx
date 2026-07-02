import { M3 } from '../theme';
import { useStore } from '../store';
import { BottomSheet, ComingSoonTag, disabledStyle, IconButton, Scrim, SheetHeader, Switch } from '../components/widgets';
import { IcBack, IcCheckCircle, IcClose, IcGear, IcPlot, IcRobot, IcWarning } from '../components/icons';

function AgentRow({ icon, iconBg, iconColor, title, sub, on, onToggle, disabled }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; title: string; sub: string; on: boolean; onToggle: () => void; disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: M3.surfaceLow, borderRadius: 16, padding: 14, ...(disabled ? disabledStyle : null) }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: iconColor }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: M3.text }}>{title}</div>
        <div style={{ fontSize: 11, color: M3.textTertiary, marginTop: 1 }}>{sub}</div>
      </div>
      {disabled ? <ComingSoonTag /> : <Switch on={on} onToggle={onToggle} />}
    </div>
  );
}

function SettingRow({ title, sub, on, onToggle, disabled }: { title: string; sub: string; on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', ...(disabled ? disabledStyle : null) }}>
      <div>
        <div style={{ fontSize: 13.5, color: M3.text }}>{title}</div>
        <div style={{ fontSize: 11, color: M3.textTertiary, marginTop: 1 }}>{sub}</div>
      </div>
      {disabled ? <ComingSoonTag /> : <Switch on={on} onToggle={onToggle} />}
    </div>
  );
}

function ModelChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: 12, fontSize: 12, fontWeight: 500,
        cursor: 'pointer', border: active ? `1.5px solid ${M3.primary}` : `1.5px solid ${M3.outline}`,
        background: active ? M3.primaryContainer : '#FFFFFF', color: active ? M3.onPrimaryContainer : M3.textSecondary,
      }}
    >
      {children}
    </div>
  );
}

export function AgentsSheet() {
  const {
    agentsOpen, agentsView, autoVerify, autoChart, autoAlert, aiModel, thinkingDepth, set,
  } = useStore();
  const close = () => set({ agentsOpen: false });

  return (
    <>
      <Scrim open={agentsOpen} onClick={close} />
      <BottomSheet open={agentsOpen} height="70%" testId="agents-sheet">
        {agentsView === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <SheetHeader
              icon={<IcRobot size={20} color={M3.primary} />}
              title="Agents"
              onClose={close}
              extra={(
                <IconButton size={32} onClick={() => set({ agentsView: 'settings' })} testId="agents-settings-btn">
                  <IcGear size={18} color={M3.textSecondary} />
                </IconButton>
              )}
            />
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: M3.textTertiary }}>已启用</div>
              <AgentRow
                icon={<IcCheckCircle size={19} color={M3.onPrimaryContainer} strokeWidth={2} />} iconBg={M3.primaryContainer} iconColor={M3.onPrimaryContainer}
                title="自动规范校核" sub="参数变化后自动重新校核" on={autoVerify} onToggle={() => set({ autoVerify: !autoVerify })}
              />
              <AgentRow
                icon={<IcPlot size={19} color={M3.onSecondaryContainer} />} iconBg={M3.secondaryContainer} iconColor={M3.onSecondaryContainer}
                title="自动生成图表" sub="计算完成后自动补充可视化" on={autoChart} onToggle={() => set({ autoChart: !autoChart })} disabled
              />
              <AgentRow
                icon={<IcWarning size={19} color={M3.onTertiaryContainer} />} iconBg={M3.tertiaryContainer} iconColor={M3.onTertiaryContainer}
                title="参数越界预警" sub="超出安全阈值时主动提醒" on={autoAlert} onToggle={() => set({ autoAlert: !autoAlert })} disabled
              />
              <div style={{ fontSize: 11.5, fontWeight: 600, color: M3.textTertiary, marginTop: 6 }}>对话历史</div>
              {[
                { title: '关于挠度公式边界条件的讨论', when: '2小时前' },
                { title: 'RF 链路余量评估', when: '昨天' },
              ].map((h) => (
                <div key={h.title} style={{ display: 'flex', alignItems: 'center', gap: 10, background: M3.surfaceLow, borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: M3.text }}>{h.title}</div>
                    <div style={{ fontSize: 10.5, color: M3.textTertiary, marginTop: 2 }}>{h.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${M3.surfaceContainer}`, gap: 10 }}>
              <IconButton size={30} onClick={() => set({ agentsView: 'list' })}>
                <IcBack size={18} color={M3.textSecondary} />
              </IconButton>
              <div style={{ fontSize: 15, fontWeight: 600, color: M3.text, flex: 1 }}>Agent 设置</div>
              <IconButton size={32} onClick={close} testId="sheet-close">
                <IcClose size={18} color={M3.textSecondary} />
              </IconButton>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={disabledStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: M3.textTertiary }}>模型选择</span>
                  <ComingSoonTag />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <ModelChip active={aiModel === 'standard'} onClick={() => {}}>标准</ModelChip>
                  <ModelChip active={aiModel === 'deep'} onClick={() => {}}>深度推理</ModelChip>
                  <ModelChip active={aiModel === 'fast'} onClick={() => {}}>快速</ModelChip>
                </div>
              </div>
              <div style={disabledStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: M3.textTertiary }}>思考深度</span>
                  <ComingSoonTag />
                </div>
                <input
                  type="range" min={0} max={2} step={1} value={thinkingDepth}
                  disabled
                  style={{ width: '100%', accentColor: M3.primary }}
                  aria-label="思考深度"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: M3.textTertiary, marginBottom: 8 }}>自动化智能体</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <SettingRow title="自动规范校核" sub="参数变化后自动重新校核" on={autoVerify} onToggle={() => set({ autoVerify: !autoVerify })} />
                  <SettingRow title="自动生成图表" sub="计算完成后自动补充可视化" on={autoChart} onToggle={() => set({ autoChart: !autoChart })} disabled />
                  <SettingRow title="参数越界预警" sub="超出安全阈值时主动提醒" on={autoAlert} onToggle={() => set({ autoAlert: !autoAlert })} disabled />
                </div>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
