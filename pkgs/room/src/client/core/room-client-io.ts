/**
 * Serial IO chain for RoomClient: durable queue appends and inbound wire
 * handlers share one promise chain so acks cannot race ahead of persist
 * (ghost durable-queue bug).
 */
export type RoomClientIoSerial = {
  /** Enqueue work; failures are reported via `onError` (never reject the chain). */
  enqueue: (work: () => Promise<void>) => void;
  /** Await the current chain (tests / flush). */
  flush: () => Promise<void>;
};

export function createRoomClientIoSerial(args: {
  readonly onError: (err: Error) => void;
}): RoomClientIoSerial {
  let chain: Promise<void> = Promise.resolve();
  return {
    enqueue: (work) => {
      chain = chain.then(work).catch((err: unknown) => {
        args.onError(err instanceof Error ? err : new Error(String(err)));
      });
    },
    flush: () => chain,
  };
}
