import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  untrack,
} from 'solid-js';

export type PendingOperation = {
  pending: Accessor<boolean>;
  cancel: () => void;
};

type Registration = PendingOperation & { approved: boolean };
type Departure = {
  proceed: () => void;
  affected: readonly PendingOperation[] | undefined;
};

/** One confirmation covers the operations interrupted by a single departure. */
export function createPendingNavigation() {
  const [operations, setOperations] = createSignal<Registration[]>([]);
  const [destination, setDestination] = createSignal<Departure | null>(null);
  const blocked = createMemo(() =>
    operations().some((operation) => operation.pending() && !operation.approved)
  );
  // The departure that may leave now: every operation it waits on finished.
  const cleared = (): Departure | null => {
    const departure = destination();
    if (departure === null) return null;
    const unfinished = departure.affected
      ? departure.affected.some((operation) => operation.pending())
      : blocked();
    return unfinished ? null : departure;
  };
  createEffect(cleared, (departure) => {
    if (departure === null) return;
    setDestination(null);
    departure.proceed();
  });
  const register = (operation: PendingOperation): (() => void) => {
    const entry = { ...operation, approved: false };
    setOperations((entries) => [...entries, entry]);
    return () =>
      setOperations((entries) => entries.filter((item) => item !== entry));
  };
  const request = (
    proceed: () => void,
    affected?: readonly PendingOperation[]
  ): void => {
    // Asked at the moment of leaving, often from inside an effect.
    if (!untrack(blocked)) {
      proceed();
      return;
    }
    if (untrack(destination) === null) setDestination({ proceed, affected });
  };
  const confirm = (): void => {
    const departure = untrack(destination);
    if (departure === null) return;
    const interrupted = untrack(operations).filter(
      (operation) =>
        operation.pending() &&
        (departure.affected === undefined ||
          departure.affected.some((item) => item.cancel === operation.cancel))
    );
    setDestination(null);
    for (const operation of interrupted) operation.approved = true;
    setOperations((entries) => [...entries]);
    for (const operation of interrupted) operation.cancel();
    departure.proceed();
  };
  return {
    blocked,
    pendingOperations: () =>
      operations().filter(
        (operation) => operation.pending() && !operation.approved
      ),
    confirming: () => destination() !== null,
    register,
    request,
    confirm,
    stay: () => setDestination(null),
  };
}

export type PendingNavigation = ReturnType<typeof createPendingNavigation>;
