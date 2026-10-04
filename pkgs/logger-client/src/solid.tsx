/** @jsxImportSource solid-js */

import type { Logger } from '@pkgs/logger-shared/logger';
import { defineContext } from '@pkgs/solid-context-client/define-context';
import type { JSX, ParentProps } from 'solid-js';

const LoggerContext = defineContext<Logger>('Logger');

export type LoggerProviderProps = ParentProps<{ readonly value: Logger }>;

/** Mounts the root {@link Logger} for the Solid tree. */
export const LoggerProvider: (props: LoggerProviderProps) => JSX.Element =
  LoggerContext.Provider;

export function useRootLogger(): Logger {
  return LoggerContext.use();
}

/**
 * Child {@link Logger} scoped to `namespace` (e.g. `'account-menu'`) so every
 * log line is tagged automatically.
 */
export function useLogger(namespace: string): Logger {
  return LoggerContext.use().child({ namespace });
}
