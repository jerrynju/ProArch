// Package registry — the modular-extension backbone for large projects,
// modeled on Wolfram paclets / MATLAB toolboxes: packages are versioned,
// declare dependencies on other packages, and are resolved transitively
// against semver-style requirements before a kernel attaches them.

import type { DomainPackage } from '../kernel/kernel';
import type { PackageReq } from '../model/types';

export type Version = [number, number, number];

export function parseVersion(v: string): Version {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(v.trim());
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
}

function cmp(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Semver requirement check. Supported forms:
 *   `*` any · `1.2.3` exact · `^1.2` compatible within major ·
 *   `~1.2` compatible within minor · `>=1.2` at least
 */
export function satisfies(version: string, req: string): boolean {
  const v = parseVersion(version);
  const r = req.trim();
  if (r === '' || r === '*') return true;
  if (r.startsWith('>=')) return cmp(v, parseVersion(r.slice(2))) >= 0;
  if (r.startsWith('^')) {
    const base = parseVersion(r.slice(1));
    return v[0] === base[0] && cmp(v, base) >= 0;
  }
  if (r.startsWith('~')) {
    const base = parseVersion(r.slice(1));
    return v[0] === base[0] && v[1] === base[1] && cmp(v, base) >= 0;
  }
  return cmp(v, parseVersion(r)) === 0;
}

export interface ResolveResult {
  /** attach order, dependencies before dependents */
  order: DomainPackage[];
  /** requirements no registered package satisfies */
  missing: PackageReq[];
  /** package names participating in a dependency cycle */
  cycles: string[];
  /** same exported symbol provided by ≥2 resolved packages */
  conflicts: { symbol: string; packages: string[] }[];
}

export class PackageRegistry {
  private byName = new Map<string, DomainPackage[]>();

  register(pkg: DomainPackage) {
    const list = this.byName.get(pkg.name) ?? [];
    // replace same-version entry (re-registration), else append
    const i = list.findIndex((p) => p.version === pkg.version);
    if (i >= 0) list[i] = pkg;
    else list.push(pkg);
    list.sort((a, b) => cmp(parseVersion(a.version), parseVersion(b.version)));
    this.byName.set(pkg.name, list);
  }

  /** highest registered version satisfying the requirement */
  get(name: string, req = '*'): DomainPackage | undefined {
    const list = this.byName.get(name) ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (satisfies(list[i].version, req)) return list[i];
    }
    return undefined;
  }

  all(): DomainPackage[] {
    return [...this.byName.values()].map((list) => list[list.length - 1]);
  }

  /** every registered package exporting `symbol` (function or constant) */
  whoProvides(symbol: string): DomainPackage[] {
    return this.all().filter((p) => p.functions.has(symbol) || (p.constants && symbol in p.constants));
  }

  /**
   * Transitive resolution: requirements → deps-first attach order.
   * DFS with an on-stack set for cycle detection; unsatisfiable reqs land in
   * `missing` (a missing dep does not abort the rest — the kernel surfaces
   * partial capability plus a precise gap report, like a MATLAB path missing
   * one toolbox).
   */
  resolve(reqs: PackageReq[]): ResolveResult {
    const order: DomainPackage[] = [];
    const done = new Set<string>();
    const onStack = new Set<string>();
    const missing: PackageReq[] = [];
    const cycles = new Set<string>();

    const visit = (req: PackageReq) => {
      if (done.has(req.name)) return;
      if (onStack.has(req.name)) {
        for (const n of onStack) cycles.add(n);
        return;
      }
      const pkg = this.get(req.name, req.version);
      if (!pkg) {
        missing.push(req);
        return;
      }
      onStack.add(req.name);
      for (const dep of pkg.requires ?? []) visit(dep);
      onStack.delete(req.name);
      done.add(req.name);
      order.push(pkg);
    };
    for (const req of reqs) visit(req);

    const provider = new Map<string, string[]>();
    for (const pkg of order) {
      const symbols = [...pkg.functions.keys(), ...Object.keys(pkg.constants ?? {})];
      for (const sym of symbols) {
        const list = provider.get(sym) ?? [];
        list.push(pkg.name);
        provider.set(sym, list);
      }
    }
    const conflicts = [...provider.entries()]
      .filter(([, pkgs]) => pkgs.length > 1)
      .map(([symbol, packages]) => ({ symbol, packages }));

    return { order, missing, cycles: [...cycles], conflicts };
  }
}
