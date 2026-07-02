import { M3 } from '../theme';
import { fmtNumber } from '../../core/kernel/kernel';
import type { PlotSpec } from '../../core/kernel/lang';

/** Declarative plot renderer (vnd.proarch.plot+json → SVG), 280×110 viewbox
 * like the design. Data auto-normalized; optional dashed reference line. */
export function PlotSvg({ plot, strokeWidth = 2.5, height = 110 }: { plot: PlotSpec; strokeWidth?: number; height?: number }) {
  const W = 280;
  const H = 110;
  const padX = 10;
  const padY = 14;
  const xs = plot.x;
  const ys = plot.y;
  const allY = plot.refY !== undefined ? [...ys, plot.refY] : ys;
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...allY, 0), yMax = Math.max(...allY);
  const sx = (x: number) => padX + ((x - xMin) / (xMax - xMin || 1)) * (W - 2 * padX);
  // larger values plot downward for deflection-style curves? No: standard up.
  const sy = (y: number) => H - padY - ((y - yMin) / (yMax - yMin || 1)) * (H - 2 * padY);

  // Beam-style: the design draws deflection hanging downward from a dashed
  // top line. We keep standard orientation but flip when all values share a
  // sign and a zero reference exists (deflection curves start at 0).
  const hangs = ys[0] === 0 && ys.every((v) => v >= 0) && plot.refY === undefined;
  const syFinal = hangs
    ? (y: number) => padY + ((y - yMin) / (yMax - yMin || 1)) * (H - 2 * padY)
    : sy;

  let d = '';
  xs.forEach((x, i) => {
    d += `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${syFinal(ys[i]).toFixed(1)} `;
  });
  const endX = sx(xs[xs.length - 1]);
  const endY = syFinal(ys[ys.length - 1]);

  if (plot.plotType === 'scatter') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height}>
        {xs.map((x, i) => <circle key={i} cx={sx(x)} cy={syFinal(ys[i])} r={3.5} fill={M3.primary} />)}
      </svg>
    );
  }

  if (plot.plotType === 'bar') {
    const barW = Math.min(28, (W - 2 * padX) / (xs.length * 1.8));
    const baseY = sy(Math.max(yMin, 0));
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} data-testid="plot-svg">
        <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} stroke={M3.outlineDim} strokeWidth={1} />
        {plot.refY !== undefined && (
          <line x1={padX} y1={sy(plot.refY)} x2={W - padX} y2={sy(plot.refY)} stroke={M3.error} strokeWidth={1} strokeDasharray="4 3" opacity={0.55} />
        )}
        {xs.map((x, i) => {
          const top = sy(ys[i]);
          return (
            <g key={i}>
              <rect
                x={sx(x) - barW / 2} y={Math.min(top, baseY)}
                width={barW} height={Math.max(2, Math.abs(baseY - top))}
                rx={3} fill={M3.primary} opacity={i === xs.length - 1 ? 1 : 0.65}
              />
              <text x={sx(x)} y={Math.min(top, baseY) - 4} textAnchor="middle" fontSize={8.5} fill={M3.textSecondary}>
                {fmtNumber(ys[i])}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} data-testid="plot-svg">
      {hangs && <line x1={padX} y1={padY} x2={W - padX} y2={padY} stroke={M3.outlineDim} strokeWidth={1} strokeDasharray="3 3" />}
      {plot.refY !== undefined && (
        <>
          <line x1={padX} y1={sy(plot.refY)} x2={W - padX} y2={sy(plot.refY)} stroke={M3.error} strokeWidth={1} strokeDasharray="4 3" opacity={0.55} />
          <text x={W - padX} y={sy(plot.refY) - 4} textAnchor="end" fontSize={8.5} fill={M3.error} opacity={0.8}>
            {fmtNumber(plot.refY)}
          </text>
        </>
      )}
      <path d={d} fill="none" stroke={M3.primary} strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx={endX} cy={endY} r={4} fill={M3.primary} />
    </svg>
  );
}

export function PlotAxisLabels({ plot }: { plot: PlotSpec }) {
  const xMin = Math.min(...plot.x);
  const xMax = Math.max(...plot.x);
  const unit = /\((.+)\)/.exec(plot.xLabel ?? '')?.[1] ?? '';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: M3.textTertiary, marginTop: 2 }}>
      <span>{`x = ${fmtNumber(xMin)}`}</span>
      <span>{plot.xLabel ?? ''}</span>
      <span>{`x = ${fmtNumber(xMax)}${unit ? ' ' + unit : ''}`}</span>
    </div>
  );
}
