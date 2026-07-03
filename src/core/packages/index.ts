// Domain package registry — every package the kernel can satisfy a
// notebook's `packages:` requirement from. Notebooks only see functions
// from packages they declare.

import type { DomainPackage } from '../kernel/kernel';
import { rfPackage } from './rf';
import { circuitPackage } from './circuit';
import { mechPackage } from './mech';
import { unitsPackage } from './units';

export const ALL_PACKAGES: DomainPackage[] = [rfPackage, circuitPackage, mechPackage, unitsPackage];
