/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import { NotebookStoreProvider } from '@pkgs/harness-console-client/notebook-store-context';
import { SqlNotebookPane } from '@pkgs/harness-console-client/sql-notebook-pane';
import { useSqlClient } from '@pkgs/sql-client-client/solid';
import { ScreenBase } from '@pkgs/ui-client/screen-base';
import type { JSX } from 'solid-js';
import { useClientEnv } from './client-env-context';

export default function ClientSqlRoute(): JSX.Element {
  const sqlClient = useSqlClient();
  const env = useClientEnv();
  return (
    <NotebookStoreProvider
      store={env.objectStore.withPrefix('client-notebooks/')}
    >
      <ScreenBase
        screenId="client-sql"
        breadcrumbs={[
          { name: <Trans>Spaces</Trans>, href: '/' },
          { name: <Trans>Settings</Trans>, href: '/more' },
          { name: <Trans>Client SQL</Trans> },
        ]}
        content={() => (
          <SqlNotebookPane sqlClient={sqlClient} nodeId="client" />
        )}
      />
    </NotebookStoreProvider>
  );
}
