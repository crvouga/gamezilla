/**
 * Serializes async side-effects (Doppler writes + webhook probe) in arrival order.
 * Always `await flush()` after the producer stops scheduling work.
 */
export class WriteQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue(task: () => Promise<void>): void {
    this.tail = this.tail.then(task);
  }

  async flush(): Promise<void> {
    await this.tail;
  }
}
