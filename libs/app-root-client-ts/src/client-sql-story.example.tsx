/** @jsxImportSource solid-js */
/**
 * Story-only SQL notebook: the production `SqlNotebookPane` over a fixed,
 * in-memory stand-in for this device's SQLite, so the inspector renders
 * without opening a real database.
 */

import { NotebookStoreProvider } from '@pkgs/harness-console-client-ts/notebook-store-context';
import { SqlNotebookPane } from '@pkgs/harness-console-client-ts/sql-notebook-pane';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { IdProvider } from '@pkgs/uuid-client-ts/solid';
import { createHarnessIds } from '@pkgs/uuid-shared-ts/seeded-create-id';
import type { JSX } from 'solid-js';

/** Answers the schema listing with `tables`; every other read is empty. */
function createStorySqlClient(tables: readonly string[]): SqlClient {
  const client: SqlClient = {
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    query: <T extends Record<string, unknown>>(query: { sql: string }) =>
      Promise.resolve(
        (query.sql.includes('sqlite_master')
          ? tables.map((name) => ({ type: 'table', name }))
          : []) as unknown as T[]
      ),
    run: () => Promise.resolve({ changes: 0, lastInsertRowid: 0 }),
    transaction: (fn) => fn(client),
    prepare: () => ({
      query: () => Promise.resolve([]),
      run: () => Promise.resolve({ changes: 0, lastInsertRowid: 0 }),
    }),
  };
  return client;
}

/** The production notebook over a stand-in database holding `tables`. */
export function StorySqlNotebook(props: {
  readonly tables: readonly string[];
}): JSX.Element {
  // Seeded, so notebook cell ids and screenshots are the same every run.
  const ids = createHarnessIds('client-sql-story');
  return (
    <IdProvider createId={ids.createId} random={ids.random}>
      <NotebookStoreProvider store={new ObjectStoreImplInMemory()}>
        <SqlNotebookPane
          sqlClient={createStorySqlClient(props.tables)}
          nodeId="client"
        />
      </NotebookStoreProvider>
    </IdProvider>
  );
}
