import {
  type Accessor,
  createContext,
  createEffect,
  onCleanup,
  useContext,
} from 'solid-js';
import {
  createPendingNavigation,
  type PendingNavigation,
  type PendingOperation,
} from './pending-navigation-state';

export const PendingNavigationContext = createContext<PendingNavigation>();

type OperationScope = Pick<
  PendingNavigation,
  'blocked' | 'register' | 'pendingOperations'
>;
export const PendingOperationScopeContext = createContext<OperationScope>();

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
  return useContext(PendingNavigationContext);
}

/** Protect cancellable work until it settles or the person confirms leaving. */
export function usePendingOperation(
  pending: Accessor<boolean>,
  cancel: () => void
): void {
  const navigation = usePendingNavigation();
  const scope = useContext(PendingOperationScopeContext);
  createEffect(() => {
    if (!pending()) return;
    if (navigation) onCleanup(navigation.register({ pending, cancel }));
    if (scope) onCleanup(scope.register({ pending, cancel }));
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
