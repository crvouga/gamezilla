/** Restore every independent report before reporting the aggregate verdict. */
export async function restoreReportQueue(
  ids: readonly string[],
  restore: (id: string) => Promise<void>
): Promise<void> {
  let next = 0;
  const failures: unknown[] = [];
  async function worker(): Promise<void> {
    for (let index = next++; index < ids.length; index = next++) {
      try {
        await restore(ids[index]!);
      } catch (error) {
        failures.push(error);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(16, ids.length) }, worker));
  if (failures.length > 0)
    throw new AggregateError(failures, 'Report cache restoration failed');
}
