// The packages this kernel build ships with. In the full product this is a
// remote paclet index; here every package is registered into a
// PackageRegistry at session start and attached on demand.

import type { DomainPackage } from '../kernel/kernel';
import { rfPackage } from './rf';
import { mechPackage } from './mech';
import { unitsPackage } from './units';

export const ALL_PACKAGES: DomainPackage[] = [rfPackage, mechPackage, unitsPackage];
