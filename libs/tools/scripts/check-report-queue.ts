/** Restore, publish and release one independent report before the next. */
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
  await worker();
  if (failures.length > 0)
    throw new AggregateError(failures, 'Report cache restoration failed');
}
