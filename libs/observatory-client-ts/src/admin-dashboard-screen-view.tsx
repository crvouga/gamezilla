import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { JSX } from '@solidjs/web';

/**
 * Home screen for signed-in administrators. Each menu row opens a tool through
 * its callback, and the Sign out action opens the account confirmation.
 */
export function AdminDashboardScreenView(props: {
  readonly onObservatory: () => void;
  readonly onPopulation: () => void;
  readonly onPuzzles: () => void;
  readonly onSignOut: () => void;
}): JSX.Element {
  return (
    <MenuScreen
      screenId="admin-dashboard"
      breadcrumbs={[{ name: <Trans>Administration</Trans> }]}
      actions={[
        {
          type: 'secondary',
          label: <Trans>Sign out</Trans>,
          onClick: () => props.onSignOut(),
        },
      ]}
    >
      <MenuSection title={<Trans>People and activity</Trans>}>
        <MenuRow
          title={<Trans>User Observatory</Trans>}
          caption={<Trans>See who is online and watch a live session.</Trans>}
          onClick={() => props.onObservatory()}
        />
        <MenuRow
          title={<Trans>Synthetic Population</Trans>}
          caption={
            <Trans>
              Inspect users and workers, review events, and manage the
              population.
            </Trans>
          }
          onClick={() => props.onPopulation()}
        />
      </MenuSection>
      <MenuSection title={<Trans>Game content</Trans>}>
        <MenuRow
          title={<Trans>Chess puzzle catalogue</Trans>}
          caption={<Trans>Manage the source file and load puzzles.</Trans>}
          onClick={() => props.onPuzzles()}
        />
      </MenuSection>
    </MenuScreen>
  );
}
