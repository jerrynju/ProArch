// Domain package registry — every package the kernel can satisfy a
// notebook's `packages:` requirement from. Notebooks only see functions
// from packages they declare.

import type { DomainPackage } from '../kernel/kernel';
import { rfPackage } from './rf';
import { circuitPackage } from './circuit';

export const ALL_PACKAGES: DomainPackage[] = [rfPackage, circuitPackage];
