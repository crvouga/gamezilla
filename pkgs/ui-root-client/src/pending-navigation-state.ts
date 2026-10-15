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
  createEffect(() => {
    const departure = destination();
    if (departure === null) return;
    const unfinished = departure.affected
      ? departure.affected.some((operation) => operation.pending())
      : blocked();
    if (unfinished) return;
    setDestination(null);
    untrack(departure.proceed);
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
    if (!blocked()) {
      proceed();
      return;
    }
    if (destination() === null) setDestination({ proceed, affected });
  };
  const confirm = (): void => {
    const departure = destination();
    if (departure === null) return;
    const interrupted = operations().filter(
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
