import type { Actor } from '@pkgs/ui-testing/explore';
import { noErrorBoundary } from '@pkgs/ui-testing/explore';

import { defineObservation, type ProductSurface } from './system';

export function actor(id: string): Actor<ProductSurface> {
  return (s) => s.actors.get(id)?.ui ?? null;
}

export const anyActor: Actor<ProductSurface> = (s) => {
  const first = s.actors.values().next().value;
  return first?.ui ?? null;
};

export const caps = defineObservation({
  name: 'caps',
  observe: (s) => [...s.session.caps] as string[],
});

export const clientIds = defineObservation({
  name: 'clientIds',
  observe: (s) => [...s.sim.clientIds()] as string[],
});

export const partitioned = defineObservation({
  name: 'partitioned',
  observe: (s) => s.session.network.partitions().map(([a, b]) => `${a}|${b}`),
});

export const PRODUCT_PROPERTIES = [noErrorBoundary(anyActor)];
