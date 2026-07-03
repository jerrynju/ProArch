// Rhai-subset expression language for ProArch v0.1.
// Hand-written recursive-descent parser + tree-walking evaluator, structured
// so the surface syntax stays compatible with a future real Rhai engine:
// `let` bindings, arithmetic (+ - * / % ^), comparisons, && ||, unary -/!,
// arrays, closures `|x| expr`, calls, backtick unit literals (30 `kN` → SI).

export interface Span { start: number; end: number }

export class LangError extends Error {
  constructor(
    public kind: 'syntax' | 'undefined_symbol' | 'type' | 'runtime',
    message: string,
    public span?: Span,
    public hint?: string,
    /** the symbol name for undefined_symbol errors (capability-gap detection) */
    public symbol?: string,
  ) {
    super(message);
  }
}

// ---------- values ----------

export type PlotSpec = {
  kind: 'plot';
  plotType: 'line' | 'scatter' | 'bar';
  x: number[];
  y: number[];
  xLabel?: string;
  yLabel?: string;
  refY?: number; // dashed reference line (e.g. limit)
};
export type CheckResult = { kind: 'check'; pass: boolean; message: string };
export type QuantityVal = { kind: 'quantity'; value: number; unit: string };
export type Closure = { kind: 'closure'; params: string[]; body: Expr; env: Env };
export type NativeFn = { kind: 'native'; name: string; fn: (args: Value[], span: Span) => Value };
export type Value = number | boolean | string | number[] | PlotSpec | CheckResult | QuantityVal | Closure | NativeFn;

export type Env = { vars: Map<string, Value>; parent?: Env };

export function lookup(env: Env, name: string): Value | undefined {
  let e: Env | undefined = env;
  while (e) {
    if (e.vars.has(name)) return e.vars.get(name);
    e = e.parent;
  }
  return undefined;
}

// SI scale factors for backtick unit literals. Log-domain units (dB, dBm)
// intentionally scale by 1 — they behave additively.
const UNIT_SCALE: Record<string, number> = {
  m: 1, mm: 1e-3, cm: 1e-2, km: 1e3,
  N: 1, kN: 1e3, MN: 1e6,
  Pa: 1, kPa: 1e3, MPa: 1e6, GPa: 1e9,
  m4: 1, cm4: 1e-8, mm4: 1e-12,
  Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9,
  s: 1, ms: 1e-3, us: 1e-6,
  dB: 1, dBm: 1, '1': 1, '%': 0.01,
};

// ---------- AST ----------

export type Expr =
  | { t: 'num'; v: number; span: Span }
  | { t: 'str'; v: string; span: Span }
  | { t: 'bool'; v: boolean; span: Span }
  | { t: 'ident'; name: string; span: Span }
  | { t: 'array'; items: Expr[]; span: Span }
  | { t: 'unary'; op: '-' | '!'; e: Expr; span: Span }
  | { t: 'bin'; op: string; l: Expr; r: Expr; span: Span }
  | { t: 'call'; callee: Expr; args: Expr[]; span: Span }
  | { t: 'index'; target: Expr; idx: Expr; span: Span }
  | { t: 'closure'; params: string[]; body: Expr; span: Span };

export type Stmt =
  | { t: 'let'; name: string; e: Expr; span: Span }
  | { t: 'assign'; name: string; e: Expr; span: Span }
  | { t: 'expr'; e: Expr; span: Span };

// ---------- tokenizer ----------

type Tok = { t: string; v: string; start: number; end: number };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const push = (t: string, v: string, start: number) => toks.push({ t, v, start, end: i });
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const start = i;
      while (i < src.length && /[0-9._]/.test(src[i])) i++;
      if (src[i] === 'e' || src[i] === 'E') {
        i++;
        if (src[i] === '+' || src[i] === '-') i++;
        while (i < src.length && /[0-9]/.test(src[i])) i++;
      }
      push('num', src.slice(start, i).replace(/_/g, ''), start);
      continue;
    }
    if (/[A-Za-z_一-鿿]/.test(c)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_一-鿿]/.test(src[i])) i++;
      push('ident', src.slice(start, i), start);
      continue;
    }
    if (c === '"') {
      const start = i;
      i++;
      let s = '';
      while (i < src.length && src[i] !== '"') { s += src[i]; i++; }
      i++;
      push('str', s, start);
      continue;
    }
    if (c === '`') {
      const start = i;
      i++;
      let s = '';
      while (i < src.length && src[i] !== '`') { s += src[i]; i++; }
      i++;
      push('unit', s, start);
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) {
      const start = i;
      i += 2;
      push('op', two, start);
      continue;
    }
    if ('+-*/%^<>=!,;()[]{}|'.includes(c)) {
      const start = i;
      i++;
      push('op', c, start);
      continue;
    }
    throw new LangError('syntax', `无法识别的字符 '${c}'`, { start: i, end: i + 1 });
  }
  return toks;
}

// ---------- parser ----------

const KEYWORDS = new Set(['let', 'true', 'false']);

class Parser {
  private pos = 0;
  constructor(private toks: Tok[], private srcLen: number) {}

  private peek(): Tok | undefined { return this.toks[this.pos]; }
  private at(t: string, v?: string): boolean {
    const tok = this.peek();
    return !!tok && tok.t === t && (v === undefined || tok.v === v);
  }
  private eat(t: string, v?: string): Tok {
    if (!this.at(t, v)) {
      const tok = this.peek();
      const span = tok ? { start: tok.start, end: tok.end } : { start: this.srcLen, end: this.srcLen };
      throw new LangError('syntax', `语法错误:期望 ${v ?? t},得到 ${tok ? `'${tok.v}'` : '文件结尾'}`, span);
    }
    return this.toks[this.pos++];
  }

  parseProgram(): Stmt[] {
    const stmts: Stmt[] = [];
    while (this.pos < this.toks.length) {
      stmts.push(this.parseStmt());
      while (this.at('op', ';')) this.pos++;
    }
    return stmts;
  }

  private parseStmt(): Stmt {
    const tok = this.peek()!;
    if (tok.t === 'ident' && tok.v === 'let') {
      this.pos++;
      const name = this.eat('ident');
      if (KEYWORDS.has(name.v)) throw new LangError('syntax', `'${name.v}' 是保留字`, name);
      this.eat('op', '=');
      const e = this.parseExpr();
      return { t: 'let', name: name.v, e, span: { start: tok.start, end: e.span.end } };
    }
    // lookahead for `ident = expr` (but not ==)
    if (tok.t === 'ident' && !KEYWORDS.has(tok.v)) {
      const next = this.toks[this.pos + 1];
      if (next && next.t === 'op' && next.v === '=') {
        this.pos += 2;
        const e = this.parseExpr();
        return { t: 'assign', name: tok.v, e, span: { start: tok.start, end: e.span.end } };
      }
    }
    const e = this.parseExpr();
    return { t: 'expr', e, span: e.span };
  }

  private parseExpr(): Expr { return this.parseOr(); }

  private binLevel(ops: string[], next: () => Expr): Expr {
    let l = next.call(this);
    while (this.at('op') && ops.includes(this.peek()!.v)) {
      const op = this.toks[this.pos++].v;
      const r = next.call(this);
      l = { t: 'bin', op, l, r, span: { start: l.span.start, end: r.span.end } };
    }
    return l;
  }

  private parseOr(): Expr { return this.binLevel(['||'], this.parseAnd); }
  private parseAnd(): Expr { return this.binLevel(['&&'], this.parseCmp); }
  private parseCmp(): Expr { return this.binLevel(['==', '!=', '<=', '>=', '<', '>'], this.parseAdd); }
  private parseAdd(): Expr { return this.binLevel(['+', '-'], this.parseMul); }
  private parseMul(): Expr { return this.binLevel(['*', '/', '%'], this.parseUnary); }

  private parseUnary(): Expr {
    if (this.at('op', '-') || this.at('op', '!')) {
      const tok = this.toks[this.pos++];
      const e = this.parseUnary();
      return { t: 'unary', op: tok.v as '-' | '!', e, span: { start: tok.start, end: e.span.end } };
    }
    return this.parsePow();
  }

  private parsePow(): Expr {
    const base = this.parsePostfix();
    if (this.at('op', '^')) {
      this.pos++;
      const exp = this.parseUnary(); // right-assoc
      return { t: 'bin', op: '^', l: base, r: exp, span: { start: base.span.start, end: exp.span.end } };
    }
    return base;
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary();
    for (;;) {
      if (this.at('op', '(')) {
        this.pos++;
        const args: Expr[] = [];
        while (!this.at('op', ')')) {
          args.push(this.parseExpr());
          if (this.at('op', ',')) this.pos++;
          else break;
        }
        const close = this.eat('op', ')');
        e = { t: 'call', callee: e, args, span: { start: e.span.start, end: close.end } };
      } else if (this.at('op', '[')) {
        this.pos++;
        const idx = this.parseExpr();
        const close = this.eat('op', ']');
        e = { t: 'index', target: e, idx, span: { start: e.span.start, end: close.end } };
      } else break;
    }
    return e;
  }

  private parsePrimary(): Expr {
    const tok = this.peek();
    if (!tok) throw new LangError('syntax', '表达式意外结束', { start: this.srcLen, end: this.srcLen });
    if (tok.t === 'num') {
      this.pos++;
      let v = Number(tok.v);
      let end = tok.end;
      if (this.at('unit')) {
        const u = this.toks[this.pos++];
        const scale = UNIT_SCALE[u.v];
        if (scale === undefined) {
          throw new LangError('type', `未知单位 \`${u.v}\``, { start: u.start, end: u.end }, '支持的单位见文档:m/mm/km、N/kN、Pa/GPa、Hz/GHz、dB/dBm 等');
        }
        v *= scale;
        end = u.end;
      }
      return { t: 'num', v, span: { start: tok.start, end } };
    }
    if (tok.t === 'str') { this.pos++; return { t: 'str', v: tok.v, span: tok }; }
    if (tok.t === 'ident') {
      if (tok.v === 'true' || tok.v === 'false') {
        this.pos++;
        return { t: 'bool', v: tok.v === 'true', span: tok };
      }
      this.pos++;
      return { t: 'ident', name: tok.v, span: tok };
    }
    if (tok.t === 'op' && tok.v === '(') {
      this.pos++;
      const e = this.parseExpr();
      this.eat('op', ')');
      return e;
    }
    if (tok.t === 'op' && tok.v === '[') {
      this.pos++;
      const items: Expr[] = [];
      while (!this.at('op', ']')) {
        items.push(this.parseExpr());
        if (this.at('op', ',')) this.pos++;
        else break;
      }
      const close = this.eat('op', ']');
      return { t: 'array', items, span: { start: tok.start, end: close.end } };
    }
    if (tok.t === 'op' && tok.v === '|') {
      // closure: |a, b| expr
      this.pos++;
      const params: string[] = [];
      while (!this.at('op', '|')) {
        params.push(this.eat('ident').v);
        if (this.at('op', ',')) this.pos++;
      }
      this.eat('op', '|');
      const body = this.parseExpr();
      return { t: 'closure', params, body, span: { start: tok.start, end: body.span.end } };
    }
    throw new LangError('syntax', `语法错误:意外的 '${tok.v}'`, tok);
  }
}

export function parse(src: string): Stmt[] {
  return new Parser(tokenize(src), src.length).parseProgram();
}

// ---------- analysis: defines / references ----------

export interface Analysis {
  defines: Set<string>;
  references: Set<string>;
}

export function analyzeProgram(stmts: Stmt[]): Analysis {
  const defines = new Set<string>();
  const references = new Set<string>();

  const walk = (e: Expr, locals: Set<string>) => {
    switch (e.t) {
      case 'ident':
        if (!locals.has(e.name) && !defines.has(e.name)) references.add(e.name);
        break;
      case 'unary': walk(e.e, locals); break;
      case 'bin': walk(e.l, locals); walk(e.r, locals); break;
      case 'call': walk(e.callee, locals); e.args.forEach((a) => walk(a, locals)); break;
      case 'index': walk(e.target, locals); walk(e.idx, locals); break;
      case 'array': e.items.forEach((a) => walk(a, locals)); break;
      case 'closure': {
        const inner = new Set(locals);
        e.params.forEach((p) => inner.add(p));
        walk(e.body, inner);
        break;
      }
      default: break;
    }
  };

  for (const s of stmts) {
    if (s.t === 'let' || s.t === 'assign') {
      walk(s.e, new Set());
      defines.add(s.name);
    } else {
      walk(s.e, new Set());
    }
  }
  return { defines, references };
}

// ---------- evaluator ----------

function asNumber(v: Value, span: Span, what: string): number {
  if (typeof v === 'number') return v;
  // quantities degrade to their numeric value in arithmetic
  if (v && typeof v === 'object' && !Array.isArray(v) && v.kind === 'quantity') return v.value;
  throw new LangError('type', `${what} 需要数值,得到 ${typeName(v)}`, span);
}

function typeName(v: Value): string {
  if (typeof v === 'number') return '数值';
  if (typeof v === 'boolean') return '布尔值';
  if (typeof v === 'string') return '字符串';
  if (Array.isArray(v)) return '数组';
  return (v as { kind: string }).kind;
}

function numericBin(op: string, a: number, b: number): number | boolean {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    case '%': return a % b;
    case '^': return Math.pow(a, b);
    case '<': return a < b;
    case '>': return a > b;
    case '<=': return a <= b;
    case '>=': return a >= b;
    case '==': return a === b;
    case '!=': return a !== b;
    default: throw new LangError('runtime', `不支持的运算符 ${op}`);
  }
}

export function callValue(fn: Value, args: Value[], span: Span): Value {
  if (fn && typeof fn === 'object' && !Array.isArray(fn)) {
    if (fn.kind === 'native') return fn.fn(args, span);
    if (fn.kind === 'closure') {
      if (args.length !== fn.params.length) {
        throw new LangError('runtime', `闭包期望 ${fn.params.length} 个参数,得到 ${args.length}`, span);
      }
      const env: Env = { vars: new Map(), parent: fn.env };
      fn.params.forEach((p, i) => env.vars.set(p, args[i]));
      return evalExpr(fn.body, env);
    }
  }
  throw new LangError('type', `${typeName(fn)} 不可调用`, span);
}

export function evalExpr(e: Expr, env: Env): Value {
  switch (e.t) {
    case 'num': return e.v;
    case 'str': return e.v;
    case 'bool': return e.v;
    case 'ident': {
      const v = lookup(env, e.name);
      if (v === undefined) {
        throw new LangError('undefined_symbol', `未定义变量 ${e.name}`, e.span, `检查拼写,或在某个单元中定义 \`let ${e.name} = …\``, e.name);
      }
      return v;
    }
    case 'array': return e.items.map((it) => asNumber(evalExpr(it, env), it.span, '数组元素'));
    case 'unary': {
      const v = evalExpr(e.e, env);
      if (e.op === '-') return -asNumber(v, e.span, '取负');
      if (typeof v !== 'boolean') throw new LangError('type', `! 需要布尔值`, e.span);
      return !v;
    }
    case 'bin': {
      const l = evalExpr(e.l, env);
      if (e.op === '&&' || e.op === '||') {
        if (typeof l !== 'boolean') throw new LangError('type', `${e.op} 需要布尔值`, e.l.span);
        if (e.op === '&&' && !l) return false;
        if (e.op === '||' && l) return true;
        const r = evalExpr(e.r, env);
        if (typeof r !== 'boolean') throw new LangError('type', `${e.op} 需要布尔值`, e.r.span);
        return r;
      }
      const r = evalExpr(e.r, env);
      // element-wise array arithmetic
      if (Array.isArray(l) || Array.isArray(r)) {
        const la = Array.isArray(l) ? l : null;
        const ra = Array.isArray(r) ? r : null;
        const n = la?.length ?? ra!.length;
        if (la && ra && la.length !== ra.length) {
          throw new LangError('type', `数组长度不一致 (${la.length} vs ${ra.length})`, e.span);
        }
        const out: number[] = [];
        for (let i = 0; i < n; i++) {
          const a = la ? la[i] : asNumber(l, e.l.span, '运算');
          const b = ra ? ra[i] : asNumber(r, e.r.span, '运算');
          const v = numericBin(e.op, a, b);
          if (typeof v !== 'number') throw new LangError('type', `数组不支持比较运算`, e.span);
          out.push(v);
        }
        return out;
      }
      if (typeof l === 'string' || typeof r === 'string') {
        if (e.op === '+') return String(l) + String(r);
        if (e.op === '==') return l === r;
        if (e.op === '!=') return l !== r;
        throw new LangError('type', `字符串不支持 ${e.op}`, e.span);
      }
      return numericBin(e.op, asNumber(l, e.l.span, '运算'), asNumber(r, e.r.span, '运算'));
    }
    case 'call': {
      const fn = evalExpr(e.callee, env);
      const args = e.args.map((a) => evalExpr(a, env));
      return callValue(fn, args, e.span);
    }
    case 'index': {
      const target = evalExpr(e.target, env);
      const idx = asNumber(evalExpr(e.idx, env), e.idx.span, '下标');
      if (!Array.isArray(target)) throw new LangError('type', `${typeName(target)} 不支持下标`, e.span);
      const v = target[Math.trunc(idx)];
      if (v === undefined) throw new LangError('runtime', `下标 ${idx} 越界 (长度 ${target.length})`, e.span);
      return v;
    }
    case 'closure':
      return { kind: 'closure', params: e.params, body: e.body, env };
  }
}

/** Run a program; returns bindings created plus the value of the last statement. */
export function evalProgram(stmts: Stmt[], globals: Env): { bindings: Map<string, Value>; last: Value | undefined } {
  const env: Env = { vars: new Map(), parent: globals };
  let last: Value | undefined;
  for (const s of stmts) {
    if (s.t === 'let' || s.t === 'assign') {
      const v = evalExpr(s.e, env);
      env.vars.set(s.name, v);
      last = v;
    } else {
      last = evalExpr(s.e, env);
    }
  }
  return { bindings: env.vars, last };
}
