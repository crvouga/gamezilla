/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import {
  NotebookStoreProvider,
  SqlNotebookPane,
} from '@pkgs/sim-console/client/sql-notebook';
import { useSqlClient } from '@pkgs/sql-client/solid';
import { ScreenBase } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { useClientEnv } from '../../shell/client-env-context';

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
