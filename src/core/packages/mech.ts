// mech domain package v1 — structural mechanics primitives (sections, bending
// stress, cantilever deflection) plus material constants. Requires the units
// package: attaching mech transitively attaches units, the same way a MATLAB
// toolbox pulls in its required toolboxes.

import { LangError, type NativeFn, type Span, type Value } from '../kernel/lang';
import type { DomainPackage } from '../kernel/kernel';

function num(v: Value, span: Span, what: string): number {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && !Array.isArray(v) && v.kind === 'quantity') return v.value;
  throw new LangError('type', `${what} 需要数值`, span);
}

function native(name: string, fn: NativeFn['fn']): [string, NativeFn] {
  return [name, { kind: 'native', name, fn }];
}

export const mechPackage: DomainPackage = {
  name: 'mech',
  version: '1.0.0',
  requires: [{ name: 'units', version: '^1.0' }],
  functions: new Map<string, NativeFn>([
    // rectangular section: second moment of area, m⁴ (b, h in m)
    native('I_rect', (args, span) => {
      const b = num(args[0], span, 'I_rect 宽度');
      const h = num(args[1], span, 'I_rect 高度');
      if (b <= 0 || h <= 0) throw new LangError('runtime', 'I_rect: 截面尺寸必须为正', span);
      return (b * Math.pow(h, 3)) / 12;
    }),
    // rectangular section modulus, m³
    native('W_rect', (args, span) => {
      const b = num(args[0], span, 'W_rect 宽度');
      const h = num(args[1], span, 'W_rect 高度');
      if (b <= 0 || h <= 0) throw new LangError('runtime', 'W_rect: 截面尺寸必须为正', span);
      return (b * h * h) / 6;
    }),
    // bending stress σ = M / W, Pa (M in N·m, W in m³)
    native('sigma_bend', (args, span) => {
      const M = num(args[0], span, 'sigma_bend 弯矩');
      const W = num(args[1], span, 'sigma_bend 截面模量');
      if (W === 0) throw new LangError('runtime', 'sigma_bend: 截面模量不能为 0', span);
      return M / W;
    }),
    // cantilever tip deflection δ = F·L³ / 3EI, m
    native('delta_tip', (args, span) => {
      const F = num(args[0], span, 'delta_tip 荷载');
      const L = num(args[1], span, 'delta_tip 跨长');
      const E = num(args[2], span, 'delta_tip 弹性模量');
      const I = num(args[3], span, 'delta_tip 惯性矩');
      if (E <= 0 || I <= 0) throw new LangError('runtime', 'delta_tip: E、I 必须为正', span);
      return (F * Math.pow(L, 3)) / (3 * E * I);
    }),
  ]),
  constants: {
    E_steel: 200e9, // Q235/Q345 steel, Pa
    E_alu: 69e9, // aluminium alloy, Pa
    sigma_y_q235: 235e6, // Q235 yield strength, Pa
  },
  docs: {
    I_rect: '`I_rect(b, h)` — 矩形截面惯性矩 b·h³/12 (m⁴)。b/h 单位 m。',
    W_rect: '`W_rect(b, h)` — 矩形截面模量 b·h²/6 (m³)。b/h 单位 m。',
    sigma_bend: '`sigma_bend(M, W)` — 弯曲应力 M/W (Pa)。M: N·m,W: m³。',
    delta_tip: '`delta_tip(F, L, E, I)` — 悬臂端挠度 F·L³/(3EI) (m)。',
    E_steel: '`E_steel` — 钢弹性模量 200 GPa。',
    E_alu: '`E_alu` — 铝合金弹性模量 69 GPa。',
    sigma_y_q235: '`sigma_y_q235` — Q235 屈服强度 235 MPa。',
  },
};
