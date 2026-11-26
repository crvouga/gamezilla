import { useSignOutModal } from '@libs/auth-client-ts/auth-modals-provider';
import { AdminDashboardScreenView } from '@libs/observatory-client-ts/admin-dashboard-screen-view';
import {
  OBSERVATORY_PATH,
  SYNTHETIC_USERS_PATH,
} from '@libs/observatory-shared-ts/observatory-routes';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import type { JSX } from '@solidjs/web';

export function AdminDashboard(): JSX.Element {
  const router = useRouter();
  const signOut = useSignOutModal();
  return (
    <AdminDashboardScreenView
      onObservatory={() => router.push(OBSERVATORY_PATH)}
      onPopulation={() => router.push(SYNTHETIC_USERS_PATH)}
      onPuzzles={() => router.push('/puzzles')}
      onSignOut={signOut.open}
    />
  );
}

export function AdminNotFound(): JSX.Element {
  const router = useRouter();
  return (
    <EmptyState
      title={<Trans>Page not found</Trans>}
      body={<Trans>Choose a tool from Administration.</Trans>}
      action={{
        label: <Trans>Open Administration</Trans>,
        onClick: () => router.replace('/'),
      }}
    />
  );
}
