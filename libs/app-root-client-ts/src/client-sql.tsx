/** @jsxImportSource solid-js */

import { NotebookStoreProvider } from '@pkgs/harness-console-client-ts/notebook-store-context';
import { SqlNotebookPane } from '@pkgs/harness-console-client-ts/sql-notebook-pane';
import { useSqlClient } from '@pkgs/sql-client-root-client-ts/solid';
import type { JSX } from 'solid-js';
import { useClientEnv } from '@libs/app-env-client-ts/client-env-context';
import { ClientSqlScreenView } from './client-sql-screen-view';

export default function ClientSqlRoute(): JSX.Element {
  const sqlClient = useSqlClient();
  const env = useClientEnv();
  return (
    <NotebookStoreProvider
      store={env.objectStore.withPrefix('client-notebooks/')}
    >
      <ClientSqlScreenView
        notebook={<SqlNotebookPane sqlClient={sqlClient} nodeId="client" />}
      />
    </NotebookStoreProvider>
  );
}
