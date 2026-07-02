// Shared param-cell renderer: sliders/selects for a card's grouped param
// cells. Used by both Calc (workbench) and Feed (draggable result cards) —
// same interaction, different chrome, per the "one model, N projections"
// principle in derive.ts.
import { M3 } from '../theme';
import { useStore } from '../store';
import { paramDisplayShort } from '../derive';
import { fmtNumber } from '../../core/kernel/kernel';
import type { Cell } from '../../core/model/types';
import { Chip, SliderRow } from '../components/widgets';

export function ParamControls({ params, compact }: { params: Cell[]; compact?: boolean }) {
  const setParam = useStore((s) => s.setParam);
  return (
    <>
      {params.map((p) => {
        if (p.kind.type !== 'param') return null;
        const k = p.kind;
        if (k.control.kind === 'slider') {
          const c = k.control;
          const v = typeof k.value === 'number' ? k.value : 0;
          return (
            <SliderRow
              key={p.id}
              label={k.label ?? k.name}
              display={`${fmtNumber(v)} ${c.unit ?? ''}`.trim()}
              min={c.min} max={c.max} step={c.step} value={v}
              onChange={(nv) => setParam(p.id, nv)}
              compact={compact}
            />
          );
        }
        if (k.control.kind === 'select') {
          return (
            <div key={p.id}>
              <div style={{ fontSize: 12.5, color: M3.textSecondary, margin: compact ? '10px 0 6px' : '14px 0 6px' }}>{k.label ?? k.name}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {k.control.options.map((opt) => (
                  <Chip
                    key={opt.label}
                    active={paramDisplayShort(p) === opt.label}
                    onClick={() => setParam(p.id, typeof opt.value === 'number' ? opt.value : 0)}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })}
    </>
  );
}
