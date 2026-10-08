/** Drain independent reports with a bounded number of live producer buckets. */
export async function processReportQueue(
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
  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, worker));
  if (failures.length > 0)
    throw new AggregateError(failures, 'Report processing failed');
}
