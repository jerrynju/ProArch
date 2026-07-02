// circuit domain package v1 — linear circuit / transient-response primitives.
// Like `rf`, these are NOT core builtins: only notebooks declaring
// `packages: [circuit: ^1.0]` see them. References: first-order RC step
// response v(t) = V·(1 − e^(−t/τ)), cutoff f_c = 1/(2πRC).

import { LangError, type NativeFn, type Span, type Value } from '../kernel/lang';
import type { DomainPackage } from '../kernel/kernel';

function num(v: Value, span: Span, what: string): number {
  if (typeof v === 'number') return v;
  throw new LangError('type', `${what} 需要数值`, span);
}

function native(name: string, fn: NativeFn['fn']): [string, NativeFn] {
  return [name, { kind: 'native', name, fn }];
}

export const circuitPackage: DomainPackage = {
  name: 'circuit',
  version: '1.0.0',
  functions: new Map<string, NativeFn>([
    // RC time constant, seconds. tau_rc(R_ohm, C_farad) = R·C
    native('tau_rc', (args, span) => {
      const r = num(args[0], span, 'tau_rc 电阻');
      const c = num(args[1], span, 'tau_rc 电容');
      if (r <= 0 || c <= 0) throw new LangError('runtime', 'tau_rc: 电阻与电容必须为正', span, '检查参数取值范围');
      return r * c;
    }),
    // charging step response: vc_step(V, t, tau) = V·(1 − e^(−t/τ))
    native('vc_step', (args, span) => {
      const v = num(args[0], span, 'vc_step 电压');
      const t = num(args[1], span, 'vc_step 时间');
      const tau = num(args[2], span, 'vc_step 时间常数');
      if (tau <= 0) throw new LangError('runtime', 'vc_step: 时间常数必须为正', span);
      return v * (1 - Math.exp(-t / tau));
    }),
    // discharge response: vc_discharge(V0, t, tau) = V0·e^(−t/τ)
    native('vc_discharge', (args, span) => {
      const v0 = num(args[0], span, 'vc_discharge 初始电压');
      const t = num(args[1], span, 'vc_discharge 时间');
      const tau = num(args[2], span, 'vc_discharge 时间常数');
      if (tau <= 0) throw new LangError('runtime', 'vc_discharge: 时间常数必须为正', span);
      return v0 * Math.exp(-t / tau);
    }),
    // first-order low-pass cutoff frequency, Hz. fc_rc(R_ohm, C_farad)
    native('fc_rc', (args, span) => {
      const r = num(args[0], span, 'fc_rc 电阻');
      const c = num(args[1], span, 'fc_rc 电容');
      if (r <= 0 || c <= 0) throw new LangError('runtime', 'fc_rc: 电阻与电容必须为正', span, '检查参数取值范围');
      return 1 / (2 * Math.PI * r * c);
    }),
  ]),
  docs: {
    tau_rc: '`tau_rc(R, C)` — RC 时间常数 τ (s)。R: 电阻 (Ω),C: 电容 (F)。τ = R·C。',
    vc_step: '`vc_step(V, t, τ)` — 充电阶跃响应电压 (V)。v(t) = V·(1 − e^(−t/τ))。',
    vc_discharge: '`vc_discharge(V₀, t, τ)` — 放电响应电压 (V)。v(t) = V₀·e^(−t/τ)。',
    fc_rc: '`fc_rc(R, C)` — 一阶低通截止频率 (Hz)。f_c = 1/(2πRC)。',
  },
};
