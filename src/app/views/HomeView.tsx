import { M3 } from '../theme';
import { getBundle, NOTEBOOK_FILES, projectOf, RECENT_CONVERSATIONS, useStore } from '../store';
import { deriveCards } from '../derive';
import { IcSparkle, IcStar, IcTrend } from '../components/icons';

export function HomeView() {
  const { openNotebook, set } = useStore();
  useStore((s) => s.tick);
  const isLoggedIn = useStore((s) => s.isLoggedIn);
  const notebookPath = useStore((s) => s.notebookPath);

  // Home is a dashboard for the *active* project — a workbench that mixes in
  // every other project's chat threads and calc runs just adds noise (and
  // leaks context you didn't ask for) whenever you're heads-down in one.
  const currentProject = projectOf(notebookPath);
  const projectFiles = NOTEBOOK_FILES.filter((f) => f.project === currentProject);
  const conversations = RECENT_CONVERSATIONS.filter((c) => projectOf(c.path) === currentProject);

  const summaries = projectFiles.map((f) => {
    const b = getBundle(f.path);
    const cards = deriveCards(b.session);
    const compute = cards.find((c) => c.kind === 'compute');
    return { file: f, summary: compute?.summary ?? '', title: b.session.notebook.meta.title };
  });

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '20px 16px 30px', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: M3.text }}>工作台</div>
      <div style={{ fontSize: 13, color: M3.textTertiary, marginTop: 3 }}>{isLoggedIn ? '王工程师' : '未登录'},欢迎回来</div>

      <div style={{ fontSize: 12, fontWeight: 600, color: M3.textTertiary, margin: '22px 0 10px' }}>最近对话</div>
      {conversations.length > 0 ? (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {conversations.map((c) => (
            <div
              key={c.title}
              data-testid="home-conversation"
              onClick={() => {
                openNotebook(c.path, 'calc');
                set({ actionMode: 'chat', actionExpanded: true, actionSubView: null });
              }}
              style={{ flexShrink: 0, width: 190, background: M3.surfaceContainer, borderRadius: 16, padding: 14, cursor: 'pointer' }}
            >
              <IcSparkle size={18} color={M3.primary} />
              <div style={{ fontSize: 13, fontWeight: 600, color: M3.text, marginTop: 8 }}>{c.title}</div>
              <div style={{ fontSize: 11.5, color: M3.textTertiary, marginTop: 4, lineHeight: 1.4 }}>{c.sub}</div>
              <div style={{ fontSize: 10.5, color: M3.textFaint, marginTop: 8 }}>{c.when}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: M3.textFaint, padding: '4px 2px' }}>本项目暂无对话记录</div>
      )}

      <div style={{ fontSize: 12, fontWeight: 600, color: M3.textTertiary, margin: '22px 0 10px' }}>最近计算</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {summaries.map(({ file, summary }, i) => (
          <div
            key={file.path}
            data-testid={`home-recent-${i}`}
            onClick={() => openNotebook(file.path, 'calc')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFFFFF', border: `1px solid ${M3.outline}`, borderRadius: 14, padding: '12px 14px', cursor: 'pointer' }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: i === 0 ? M3.primaryContainer : M3.secondaryContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IcTrend size={17} color={i === 0 ? M3.onPrimaryContainer : M3.onSecondaryContainer} strokeWidth={1.9} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: M3.text }}>{file.fileName}</div>
              <div style={{ fontSize: 11.5, color: M3.textTertiary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summary}
              </div>
            </div>
            <span style={{ fontSize: 10.5, color: M3.textFaint, flexShrink: 0 }}>{file.recency}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: M3.textTertiary, margin: '22px 0 10px' }}>收藏</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {NOTEBOOK_FILES.map((f) => (
          <div key={f.path} onClick={() => openNotebook(f.path, 'calc')} style={{ background: '#FFFFFF', border: `1px solid ${M3.outline}`, borderRadius: 14, padding: 12, cursor: 'pointer' }}>
            <IcStar size={15} />
            <div style={{ fontSize: 12.5, fontWeight: 600, color: M3.text, marginTop: 8 }}>{f.fileName}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
