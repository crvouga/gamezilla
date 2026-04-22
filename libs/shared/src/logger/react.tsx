import { useMemo } from 'react';
import { useDependency } from '../dependency-injection/react';
import type { Logger } from './logger';
import { LoggerToken } from './token';

/**
 * Returns a child {@link Logger} scoped to the given namespace.
 * The root logger is resolved from the DI container; callers get a
 * `.child({ namespace })` so every log line is tagged automatically.
 *
 * @param namespace - Required label that appears in every log entry
 *                    (e.g. `'account-menu'`, `'patch-bootstrap'`).
 */
export function useLogger(namespace: string): Logger {
  const root = useDependency(LoggerToken);
  return useMemo(() => root.child({ namespace }), [root, namespace]);
}
