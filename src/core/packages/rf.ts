// rf domain package v1 — RF/microwave primitives (multi-domain demo).
// Functions here are NOT core builtins: they are only available in notebooks
// that declare `packages: [rf: ^1.0]`, exactly as domain packages ship in the
// full product. References: Friis transmission equation, ITU FSPL definition.

import { LangError, type NativeFn, type Span, type Value } from '../kernel/lang';
import type { DomainPackage } from '../kernel/kernel';

function num(v: Value, span: Span, what: string): number {
  if (typeof v === 'number') return v;
  throw new LangError('type', `${what} 需要数值`, span);
}

function native(name: string, fn: NativeFn['fn']): [string, NativeFn] {
  return [name, { kind: 'native', name, fn }];
}

const C0 = 299_792_458; // m/s

export const rfPackage: DomainPackage = {
  name: 'rf',
  version: '1.0.0',
  functions: new Map<string, NativeFn>([
    // Free-space path loss, dB. fspl(d_m, f_hz) = 20log10(4πdf/c)
    native('fspl', (args, span) => {
      const d = num(args[0], span, 'fspl 距离');
      const f = num(args[1], span, 'fspl 频率');
      if (d <= 0 || f <= 0) throw new LangError('runtime', 'fspl: 距离与频率必须为正', span, '检查参数取值范围');
      return 20 * Math.log10((4 * Math.PI * d * f) / C0);
    }),
    // dBm ↔ W
    native('dbm_to_w', (args, span) => Math.pow(10, (num(args[0], span, 'dbm_to_w') - 30) / 10)),
    native('w_to_dbm', (args, span) => 10 * Math.log10(num(args[0], span, 'w_to_dbm')) + 30),
    // linear ↔ dB
    native('db', (args, span) => 10 * Math.log10(num(args[0], span, 'db'))),
    native('undb', (args, span) => Math.pow(10, num(args[0], span, 'undb') / 10)),
    // wavelength (m) from frequency (Hz)
    native('wavelength', (args, span) => C0 / num(args[0], span, 'wavelength')),
  ]),
  docs: {
    fspl: '`fspl(d, f)` — 自由空间路径损耗 (dB)。d: 距离 (m),f: 频率 (Hz)。FSPL = 20·log₁₀(4πdf/c)。',
    dbm_to_w: '`dbm_to_w(p)` — dBm 转瓦特。',
    w_to_dbm: '`w_to_dbm(p)` — 瓦特转 dBm。',
    db: '`db(x)` — 线性值转 dB (10·log₁₀x)。',
    undb: '`undb(x)` — dB 转线性值。',
    wavelength: '`wavelength(f)` — 波长 (m),f: 频率 (Hz)。',
  },
};

export const ALL_PACKAGES: DomainPackage[] = [rfPackage];
