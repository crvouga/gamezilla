export const CLIENT_IDS = ['c0', 'c1', 'c2'] as const;

export function defaultClientIds(
  clientIds: readonly string[]
): readonly string[] {
  return clientIds.length > 0 ? clientIds : [...CLIENT_IDS].slice(0, 2);
}
