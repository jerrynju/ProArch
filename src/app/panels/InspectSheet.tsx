import { M3 } from '../theme';
import { useSession, useStore } from '../store';
import { BottomSheet, Scrim, SheetHeader } from '../components/widgets';
import { IcSparkle } from '../components/icons';

/** Minimal renderer for the kernel's inspect markdown (bold + inline code). */
function InspectText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return <strong key={i} style={{ color: M3.text }}>{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith('`') && p.endsWith('`')) {
          return (
            <code key={i} style={{
              fontFamily: "ui-monospace,'SFMono-Regular',Consolas,monospace", fontSize: 12,
              background: M3.surfaceContainer, borderRadius: 5, padding: '1px 5px', color: M3.onPrimaryContainer,
            }}>
              {p.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

/**
 * Wolfram-notebook-style symbol inspector. The kernel protocol has carried an
 * `inspect` op since v0.1 (docs for package functions, live values for
 * notebook symbols) — this sheet finally projects it into the UI: tap a
 * dependency chip on a Calc card and see what the symbol is, right now.
 */
export function InspectSheet() {
  const inspectSymbol = useStore((s) => s.inspectSymbol);
  const set = useStore((s) => s.set);
  const { session } = useSession();
  const close = () => set({ inspectSymbol: null });

  const reply = inspectSymbol ? session.request({ op: 'inspect', symbol: inspectSymbol }) : null;
  const markdown = reply?.op === 'inspection' ? reply.markdown : '';
  const definer = inspectSymbol
    ? session.notebook.cells.find((c) => session.definesOf(c.id).includes(inspectSymbol))
    : undefined;

  return (
    <>
      <Scrim open={inspectSymbol !== null} onClick={close} />
      <BottomSheet open={inspectSymbol !== null} height="42%" testId="inspect-sheet">
        <SheetHeader
          icon={<IcSparkle size={18} color={M3.primary} />}
          title={`符号 · ${inspectSymbol ?? ''}`}
          onClose={close}
        />
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {markdown.split('\n\n').map((para, i) => (
            <div key={i} style={{ fontSize: 13.5, lineHeight: 1.65, color: M3.textSecondary }} data-testid={i === 0 ? 'inspect-body' : undefined}>
              <InspectText text={para} />
            </div>
          ))}
          {definer && (
            <div
              onClick={() => {
                close();
                useStore.getState().selectCell(definer.id);
                useStore.getState().goMode('calc');
              }}
              style={{
                marginTop: 4, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 12, background: M3.primaryContainer,
                color: M3.onPrimaryContainer, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}
              data-testid="inspect-goto-definer"
            >
              定位到定义单元
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
