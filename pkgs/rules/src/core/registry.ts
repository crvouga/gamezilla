import type { Rule } from './types';

export type RulesRegistry = {
  readonly rules: readonly Rule[];
};

export function createRulesRegistry(
  ...parts: readonly Rule[][]
): RulesRegistry {
  return { rules: parts.flat() };
}
