// Core primitive library available to every notebook (no package required).

import { LangError, callValue, type NativeFn, type Span, type Value } from './lang';

function num(v: Value, span: Span, what: string): number {
  if (typeof v === 'number') return v;
  throw new LangError('type', `${what} 需要数值`, span);
}
function arr(v: Value, span: Span, what: string): number[] {
  if (Array.isArray(v)) return v;
  throw new LangError('type', `${what} 需要数组`, span);
}

function native(name: string, fn: NativeFn['fn']): [string, NativeFn] {
  return [name, { kind: 'native', name, fn }];
}

function math1(name: string, f: (x: number) => number): [string, NativeFn] {
  return native(name, (args, span) => {
    const v = args[0];
    if (Array.isArray(v)) return v.map(f);
    return f(num(v, span, name));
  });
}

export const CORE_BUILTINS = new Map<string, NativeFn>([
  math1('abs', Math.abs),
  math1('sqrt', Math.sqrt),
  math1('log10', Math.log10),
  math1('ln', Math.log),
  math1('exp', Math.exp),
  math1('floor', Math.floor),
  math1('ceil', Math.ceil),
  math1('round', Math.round),
  math1('sin', Math.sin),
  math1('cos', Math.cos),
  native('pow', (args, span) => Math.pow(num(args[0], span, 'pow'), num(args[1], span, 'pow'))),
  native('min', (args, span) => Math.min(...args.map((a) => num(a, span, 'min')))),
  native('max', (args, span) => Math.max(...args.map((a) => num(a, span, 'max')))),
  native('len', (args, span) => arr(args[0], span, 'len').length),
  native('sum', (args, span) => arr(args[0], span, 'sum').reduce((a, b) => a + b, 0)),
  native('linspace', (args, span) => {
    const a = num(args[0], span, 'linspace');
    const b = num(args[1], span, 'linspace');
    const n = Math.max(2, Math.trunc(num(args[2], span, 'linspace')));
    return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  }),
  native('map', (args, span) => {
    const xs = arr(args[0], span, 'map');
    const fn = args[1];
    return xs.map((x) => {
      const v = callValue(fn, [x], span);
      return num(v, span, 'map 回调返回值');
    });
  }),
  native('plot', (args, span) => {
    const x = arr(args[0], span, 'plot');
    const y = arr(args[1], span, 'plot');
    if (x.length !== y.length) throw new LangError('type', `plot: x/y 长度不一致`, span);
    const opts = (typeof args[2] === 'string' ? args[2] : '') as string;
    // options mini-syntax: "type=line;xlabel=…;ylabel=…;ref=<num>"
    const kv: Record<string, string> = {};
    for (const part of opts.split(';')) {
      const [k, v] = part.split('=');
      if (k && v !== undefined) kv[k.trim()] = v.trim();
    }
    return {
      kind: 'plot',
      plotType: (kv.type === 'scatter' || kv.type === 'bar' ? kv.type : 'line'),
      x, y,
      xLabel: kv.xlabel,
      yLabel: kv.ylabel,
      refY: kv.ref !== undefined ? Number(kv.ref) : undefined,
    };
  }),
  native('quantity', (args, span) => ({
    kind: 'quantity',
    value: num(args[0], span, 'quantity'),
    unit: typeof args[1] === 'string' ? args[1] : '',
  })),
  native('check', (args, span) => {
    const cond = args[0];
    if (typeof cond !== 'boolean') throw new LangError('type', 'check 第一个参数需要布尔值', span);
    const passMsg = typeof args[1] === 'string' ? args[1] : '通过';
    const failMsg = typeof args[2] === 'string' ? args[2] : '未通过';
    return { kind: 'check', pass: cond, message: cond ? passMsg : failMsg };
  }),
]);
