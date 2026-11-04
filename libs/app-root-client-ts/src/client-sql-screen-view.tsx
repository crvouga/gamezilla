/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import { ScreenBase } from '@pkgs/ui-root-client-ts/screen-base';
import type { JSX } from 'solid-js';

export type ClientSqlScreenViewProps = {
  /** The SQL notebook over this device's local database. */
  readonly notebook: JSX.Element;
};

/**
 * `/client/sql`, presentational: the Settings breadcrumbs around a SQL
 * notebook on this device's local database. `ClientSqlRoute` supplies the
 * notebook wired to the live SQL client and its saved cells.
 */
export function ClientSqlScreenView(
  props: ClientSqlScreenViewProps
): JSX.Element {
  return (
    <ScreenBase
      screenId="client-sql"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Client SQL</Trans> },
      ]}
      content={() => props.notebook}
    />
  );
}
