import { createContext, useContext, useMemo } from 'react';
import type { Logger } from './logger';

const LoggerContext = createContext<Logger | null>(null);

export const LoggerContextProvider = LoggerContext.Provider;

/**
 * Returns a child {@link Logger} scoped to the given namespace.
 * The root logger is resolved from {@link LoggerContextProvider}; callers get a
 * `.child({ namespace })` so every log line is tagged automatically.
 *
 * @param namespace - Required label that appears in every log entry
 *                    (e.g. `'account-menu'`, `'patch-bootstrap'`).
 */
export function useRootLogger(): Logger {
  const root = useContext(LoggerContext);
  if (root === null) {
    throw new Error('useRootLogger: LoggerContextProvider missing');
  }
  return root;
}

export function useLogger(namespace: string): Logger {
  const root = useRootLogger();
  return useMemo(() => root.child({ namespace }), [root, namespace]);
}
