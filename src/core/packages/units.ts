// units domain package v1 — engineering unit conversion helpers + physical
// constants. Base dependency for other engineering packages (mech requires
// it), demonstrating registry-level dependency resolution.

import { LangError, type NativeFn, type Span, type Value } from '../kernel/lang';
import type { DomainPackage } from '../kernel/kernel';

function num(v: Value, span: Span, what: string): number {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && !Array.isArray(v) && v.kind === 'quantity') return v.value;
  throw new LangError('type', `${what} 需要数值`, span);
}

function conv(name: string, scale: number): [string, NativeFn] {
  return [name, { kind: 'native', name, fn: (args, span) => num(args[0], span, name) * scale }];
}

export const unitsPackage: DomainPackage = {
  name: 'units',
  version: '1.1.0',
  requires: [],
  functions: new Map<string, NativeFn>([
    conv('kn', 1e3), // kN → N
    conv('mpa', 1e6), // MPa → Pa
    conv('gpa', 1e9), // GPa → Pa
    conv('mm', 1e-3), // mm → m
    conv('cm4', 1e-8), // cm⁴ → m⁴
    conv('km', 1e3), // km → m
  ]),
  constants: {
    g0: 9.80665, // standard gravity, m/s²
  },
  docs: {
    kn: '`kn(x)` — 千牛转牛 (×10³)。',
    mpa: '`mpa(x)` — 兆帕转帕 (×10⁶)。',
    gpa: '`gpa(x)` — 吉帕转帕 (×10⁹)。',
    mm: '`mm(x)` — 毫米转米 (×10⁻³)。',
    cm4: '`cm4(x)` — cm⁴ 转 m⁴ (×10⁻⁸)。',
    km: '`km(x)` — 千米转米 (×10³)。',
    g0: '`g0` — 标准重力加速度 9.80665 m/s²。',
  },
};
