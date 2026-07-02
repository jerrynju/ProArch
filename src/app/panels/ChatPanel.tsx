import { useEffect, useRef, useState } from 'react';
import { M3 } from '../theme';
import { useSession, useStore } from '../store';
import { IconButton } from '../components/widgets';
import { IcBack, IcGear, IcSend, IcSparkle } from '../components/icons';

const SLASH_COMMANDS = [
  { cmd: '/calc', desc: '插入新计算单元' },
  { cmd: '/plot', desc: '插入图表单元' },
  { cmd: '/verify', desc: '运行规范校核' },
  { cmd: '/explain', desc: '解释当前结果' },
];

function ModeChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

export function ChatPanel({ busy }: { busy: boolean }) {
  const { agentMode, slashPanelOpen, set, sendPrompt, selectedCellId, insertSnippet } = useStore();
  const bundle = useSession();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setInput('');
    sendPrompt(text.trim(), { cellId: selectedCellId ?? undefined });
  };

  const runSlash = (cmd: string) => {
    set({ slashPanelOpen: false });
    if (cmd === '/calc') insertSnippet('code', 'let 结果 = 0.0;\nquantity(结果, "")', '新计算');
    else if (cmd === '/plot') insertSnippet('code', 'let xs = linspace(0.0, 10.0, 24);\nlet ys = map(xs, |x| x);\nplot(xs, ys)', '新图表');
    else if (cmd === '/verify') sendPrompt('运行规范校核并汇报结果');
    else if (cmd === '/explain') sendPrompt('解释当前结果', { cellId: selectedCellId ?? undefined });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} data-testid="chat-panel">
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', borderBottom: `1px solid ${M3.outline}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 8px' }}>
          <IconButton size={28} onClick={() => set({ actionMode: 'tools' })} testId="chat-back">
            <IcBack size={17} color={M3.textSecondary} />
          </IconButton>
          <IcSparkle size={17} color={M3.primary} />
          <div style={{ fontSize: 14.5, fontWeight: 600, color: M3.text, flex: 1 }}>Agent</div>
          <IconButton size={28} onClick={() => set({ agentsOpen: true, drawerOpen: false, artifactsOpen: false, agentsView: 'settings' })}>
            <IcGear size={16} color={M3.textSecondary} />
          </IconButton>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '0 14px 10px' }}>
          <ModeChip active={agentMode === 'chat'} onClick={() => set({ agentMode: 'chat' })}>对话模式</ModeChip>
          <ModeChip active={agentMode === 'auto'} onClick={() => set({ agentMode: 'auto' })}>自主执行</ModeChip>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bundle.messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.steps.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: M3.textTertiary,
                background: '#FFFFFF', borderRadius: 10, padding: '5px 10px', border: `1px solid ${M3.outline}`,
              }}>
                <span style={{ fontFamily: 'ui-monospace,monospace', color: M3.primary }}>{s.tool}</span>
                <span>{s.summary}</span>
                <span>{s.ok === undefined ? '…' : s.ok ? '✓' : '✗'}</span>
              </div>
            ))}
            {(m.text || m.streaming) && (
              <div style={{
                maxWidth: '82%', padding: '10px 14px', fontSize: 13, lineHeight: 1.5,
                background: m.role === 'user' ? M3.primaryContainer : '#FFFFFF',
                color: m.role === 'user' ? M3.onPrimaryContainer : M3.text,
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              }} data-testid={`msg-${m.role}`}>
                {m.text}{m.streaming ? '▍' : ''}
              </div>
            )}
          </div>
        ))}
      </div>

      {slashPanelOpen && (
        <div style={{ flexShrink: 0, borderTop: `1px solid ${M3.outline}`, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: M3.textTertiary, padding: '4px 8px' }}>斜杠命令</div>
          {SLASH_COMMANDS.map((s) => (
            <div key={s.cmd} onClick={() => runSlash(s.cmd)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, cursor: 'pointer' }} data-testid={`slash-${s.cmd.slice(1)}`}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: M3.primary, width: 56 }}>{s.cmd}</span>
              <span style={{ fontSize: 12, color: M3.textTertiary }}>{s.desc}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: `1px solid ${M3.outline}` }}>
        <div
          onClick={() => set({ slashPanelOpen: !slashPanelOpen })}
          data-testid="slash-toggle"
          style={{
            width: 38, height: 38, borderRadius: 19, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: slashPanelOpen ? M3.primary : M3.surfaceContainer, color: slashPanelOpen ? '#FFFFFF' : M3.primary,
            fontWeight: 700, fontSize: 15, cursor: 'pointer',
          }}
        >
          /
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
          placeholder={agentMode === 'auto' ? '描述目标,Agent 将自主执行…' : '向 Agent 提问…'}
          data-testid="chat-input"
          style={{
            flex: 1, background: '#FFFFFF', borderRadius: 20, padding: '10px 14px', fontSize: 13,
            color: M3.text, border: 'none', outline: 'none',
          }}
        />
        <div
          onClick={() => send(input || (agentMode === 'auto' ? '自主调整参数并重新校核' : ''))}
          data-testid="chat-send"
          style={{
            width: 38, height: 38, borderRadius: 19, background: busy ? M3.outlineDim : M3.primary, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer',
          }}
        >
          <IcSend size={16} />
        </div>
      </div>
    </div>
  );
}
