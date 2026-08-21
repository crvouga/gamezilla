export type TestNeighbor = {
  readonly prev: string | null;
  readonly next: string | null;
  readonly index: number;
  readonly total: number;
};

type TestIdRow = {
  readonly testId: string;
};

/**
 * Prev/next in suite-table default order (`testId` localeCompare).
 * Disabled at the ends — no wrap-around.
 */
export function resolveTestNeighbor(
  tests: readonly TestIdRow[],
  testId: string
): TestNeighbor {
  const ordered = [...tests].sort((a, b) => a.testId.localeCompare(b.testId));
  const index = ordered.findIndex((row) => row.testId === testId);
  if (index < 0) {
    return { prev: null, next: null, index: -1, total: ordered.length };
  }
  return {
    prev: ordered[index - 1]?.testId ?? null,
    next: ordered[index + 1]?.testId ?? null,
    index,
    total: ordered.length,
  };
}
