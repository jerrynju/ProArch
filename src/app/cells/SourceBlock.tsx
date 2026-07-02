import { M3 } from '../theme';

/** Dark code block matching the design's source styling. */
export function SourceBlock({ source }: { source: string }) {
  return (
    <div style={{
      background: M3.codeBg, borderRadius: 12, padding: '12px 14px', marginTop: 6,
      fontFamily: "ui-monospace,'SFMono-Regular',Consolas,monospace",
      fontSize: 11.5, lineHeight: 1.7, color: M3.codeText, overflowX: 'auto', whiteSpace: 'pre',
    }}>
      {source.split('\n').map((line, i) => {
        const comment = line.indexOf('//');
        const code = comment >= 0 ? line.slice(0, comment) : line;
        const cm = comment >= 0 ? line.slice(comment) : '';
        const m = /^(\s*let\s+)([A-Za-z_一-鿿][\w一-鿿]*)(.*)$/.exec(code);
        return (
          <div key={i}>
            {m ? (
              <>
                <span style={{ color: M3.codeComment }}>{m[1]}</span>
                <span style={{ color: M3.codeVar }}>{m[2]}</span>
                <span>{m[3]}</span>
              </>
            ) : (
              <span style={{ color: code.trim().startsWith('quantity') || code.trim().startsWith('check') || code.trim().startsWith('plot') ? M3.codeEm : undefined }}>{code}</span>
            )}
            {cm && <span style={{ color: M3.codeComment }}>{cm}</span>}
          </div>
        );
      })}
    </div>
  );
}
