import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  useContext,
} from 'solid-js';
import {
  createPendingNavigation,
  type PendingNavigation,
  type PendingOperation,
} from './pending-navigation-state';

export const PendingNavigationContext = createContext<PendingNavigation | null>(
  null
);

type OperationScope = Pick<
  PendingNavigation,
  'blocked' | 'register' | 'pendingOperations'
>;
export const PendingOperationScopeContext =
  createContext<OperationScope | null>(null);

/** A dismissible surface only guards work owned by its content. */
export function createPendingOperationScope(): OperationScope {
  const parent = useContext(PendingOperationScopeContext);
  const local = createPendingNavigation();
  return {
    blocked: local.blocked,
    pendingOperations: local.pendingOperations,
    register(operation: PendingOperation) {
      const unregister = local.register(operation);
      const unregisterParent = parent?.register(operation);
      return () => {
        unregister();
        unregisterParent?.();
      };
    },
  };
}

export function usePendingNavigation(): PendingNavigation | undefined {
  return useContext(PendingNavigationContext) ?? undefined;
}

/** Protect cancellable work until it settles or the person confirms leaving. */
export function usePendingOperation(
  pending: Accessor<boolean>,
  cancel: () => void
): void {
  const navigation = usePendingNavigation();
  const scope = useContext(PendingOperationScopeContext);
  createEffect(createMemo(pending), (isPending) => {
    if (!isPending) return undefined;
    const leaveNavigation = navigation?.register({ pending, cancel });
    const leaveScope = scope?.register({ pending, cancel });
    return () => {
      leaveNavigation?.();
      leaveScope?.();
    };
  });
}

/** Use for navigation that changes embedded content without changing the URL. */
export function useConfirmNavigation(): PendingNavigation['request'] {
  const navigation = usePendingNavigation();
  return (proceed, affected) => {
    if (navigation) navigation.request(proceed, affected);
    else proceed();
  };
}
