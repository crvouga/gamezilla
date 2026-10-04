import type { Sql } from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';

import type { TableChangeBus } from './table-change-bus';

/**
 * Schedules watch listener notification. The default runs listeners
 * synchronously; a UI host may inject a lower-priority scheduler so
 * scroll/tap paint wins over snapshot apply (INP).
 */
export type ScheduleNotify = (notify: () => void) => void;

export const notifySynchronously: ScheduleNotify = (notify) => notify();

export type SqlWatchHandle<T extends Record<string, unknown>> = {
  readonly getSnapshot: () => readonly T[];
  readonly getHydrated: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
  readonly close: () => void;
};

function queryTableNames(sqlText: string): ReadonlySet<string> {
  const tables = new Set<string>();
  const matcher = /\b(?:FROM|JOIN)\s+["`[]?([a-z_][a-z0-9_]*)/giu;
  for (const match of sqlText.matchAll(matcher)) {
    const table = match[1];
    if (table !== undefined) tables.add(table);
  }
  return tables;
}

function intersects(
  dependencies: ReadonlySet<string>,
  changed: ReadonlySet<string>
): boolean {
  if (dependencies.size === 0) return true;
  for (const table of changed) {
    if (dependencies.has(table)) return true;
  }
  return false;
}

function logWatchError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`SQL watch refresh failed: ${message}`);
}

/**
 * Event-driven SQL watch. Reads once immediately, then only after a relevant
 * post-commit table notification. Listener notifies run through the injected
 * {@link ScheduleNotify} (synchronous by default).
 */
export function createSqlWatch<T extends Record<string, unknown>>(args: {
  readonly db: Pick<SqlClient, 'query'>;
  readonly bus: TableChangeBus;
  readonly query: Sql<T>;
  readonly scheduleNotify?: ScheduleNotify;
}): SqlWatchHandle<T> {
  const scheduleNotify = args.scheduleNotify ?? notifySynchronously;
  const listeners = new Set<() => void>();
  const dependencies = queryTableNames(args.query.sql);
  let snapshot: readonly T[] = [];
  let hydrated = false;
  let closed = false;
  let reading = false;
  let pending = false;

  const notify = (): void => {
    scheduleNotify(() => {
      for (const listener of listeners) listener();
    });
  };

  const refresh = async (): Promise<void> => {
    if (closed) return;
    if (reading) {
      pending = true;
      return;
    }
    reading = true;
    try {
      snapshot = await args.db.query(args.query);
      hydrated = true;
      notify();
    } finally {
      reading = false;
      if (pending) {
        pending = false;
        void refresh().catch(logWatchError);
      }
    }
  };

  const disposeBus = args.bus.subscribe((changed) => {
    if (intersects(dependencies, changed)) {
      void refresh().catch(logWatchError);
    }
  });
  void refresh().catch(logWatchError);

  return {
    getSnapshot: () => snapshot,
    getHydrated: () => hydrated,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => {
      closed = true;
      disposeBus();
      listeners.clear();
    },
  };
}
