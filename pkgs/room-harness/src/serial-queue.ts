/** Serialize async work so RoomServer committedState updates never interleave. */
export class SerialQueue {
  private chain: Promise<void> = Promise.resolve();

  enqueue(work: () => Promise<void>): Promise<void> {
    const run = this.chain.then(work, work);
    this.chain = run.catch(() => undefined);
    return run;
  }

  flush(): Promise<void> {
    return this.chain.then(() => undefined);
  }
}
