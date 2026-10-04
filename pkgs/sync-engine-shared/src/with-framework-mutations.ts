import { mutationRegistry } from './mutations-registry';
import type { Mutation, MutationRegistry } from './mutations-types';
import { FRAMEWORK_MUTATIONS } from './acknowledge-write-rejection';

/** Merge product mutations with framework mutations (idempotent by name). */
export function withFrameworkMutations(
  product: MutationRegistry
): MutationRegistry {
  const productList = Object.values(product) as Mutation<unknown>[];
  const frameworkNames = new Set(FRAMEWORK_MUTATIONS.map((m) => m.name));
  const withoutFramework = productList.filter(
    (m) => !frameworkNames.has(m.name)
  );
  return mutationRegistry([...FRAMEWORK_MUTATIONS, ...withoutFramework]);
}
