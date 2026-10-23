/** A SQLite connection executes one transaction at a time, even across awaits. */
export function createTransactionChain(): <T>(
  fn: () => Promise<T>
) => Promise<T> {
  let chain: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };
}
