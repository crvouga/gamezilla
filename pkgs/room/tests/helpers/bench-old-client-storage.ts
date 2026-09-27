/**
 * The previous `ClientRoomStorage` port (whole-log `saveCommitted`,
 * append/remove queue rows), shaped like the old in-memory adapter. Used only
 * to drive the old engine snapshot in the benchmark.
 */
export function oldMemoryClientStorage(): unknown {
  let lastSeq = 0;
  let entries: unknown[] = [];
  let queue: { id: string }[] = [];
  return {
    async loadCommitted() {
      return { lastSeq, entries: [...entries] };
    },
    async saveCommitted(nextLastSeq: number, nextEntries: unknown[]) {
      lastSeq = nextLastSeq;
      entries = [...nextEntries];
    },
    async loadQueued() {
      return [...queue];
    },
    async appendQueued(cmd: { id: string }) {
      queue.push(cmd);
    },
    async removeQueued(id: string) {
      queue = queue.filter((c) => c.id !== id);
    },
  };
}
