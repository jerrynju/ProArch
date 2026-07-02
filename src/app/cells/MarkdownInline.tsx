// Minimal continuous-flow markdown renderer for Read mode: bold, inline
// code, inline $formula$ math (approximated, no KaTeX dependency), and
// paragraph/bullet splitting. Not a general CommonMark engine — just enough
// to make Read feel like prose instead of a raw source dump.
import { M3 } from '../theme';

function renderInline(text: string, keyBase: string) {
  const tokens: { re: RegExp; render: (m: string, i: number) => React.ReactNode }[] = [
    { re: /\*\*(.+?)\*\*/g, render: (m, i) => <strong key={`${keyBase}-b${i}`} style={{ fontWeight: 700, color: M3.text }}>{m}</strong> },
    { re: /`(.+?)`/g, render: (m, i) => (
      <code key={`${keyBase}-c${i}`} style={{ fontFamily: "ui-monospace,'SFMono-Regular',Consolas,monospace", fontSize: '0.92em', background: M3.surfaceContainer, padding: '1px 5px', borderRadius: 5 }}>{m}</code>
    ) },
    { re: /\$(.+?)\$/g, render: (m, i) => <em key={`${keyBase}-m${i}`} style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{m}</em> },
  ];
  // Merge all matches across the three patterns in source order.
  type Match = { start: number; end: number; node: React.ReactNode };
  const matches: Match[] = [];
  for (const { re, render } of tokens) {
    let m: RegExpExecArray | null;
    let i = 0;
    const r = new RegExp(re);
    while ((m = r.exec(text))) {
      matches.push({ start: m.index, end: m.index + m[0].length, node: render(m[1], i++) });
    }
  }
  matches.sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue; // overlapping match, skip
    if (m.start > cursor) out.push(text.slice(cursor, m.start));
    out.push(m.node);
    cursor = m.end;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

export function MarkdownFlow({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^[-*]\s/.test(l.trim()))) {
          return (
            <ul key={bi} style={{ margin: '0 0 12px', paddingLeft: 20 }}>
              {lines.map((l, li) => (
                <li key={li} style={{ fontSize: 14, lineHeight: 1.75, color: M3.textSecondary, marginBottom: 2 }}>
                  {renderInline(l.trim().replace(/^[-*]\s/, ''), `${bi}-${li}`)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} style={{ fontSize: 14, lineHeight: 1.8, color: M3.textSecondary, margin: '0 0 14px' }}>
            {renderInline(block, `${bi}`)}
          </p>
        );
      })}
    </div>
  );
}
