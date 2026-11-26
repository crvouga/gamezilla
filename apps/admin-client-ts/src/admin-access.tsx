import { useClientEnv } from '@libs/app-env-client-ts/client-env-context';
import {
  useSignInModal,
  useSignOutModal,
} from '@libs/auth-client-ts/auth-modals-provider';
import { useClientRequestAuth } from '@libs/auth-client-ts/use-client-request-auth';
import { clientAuthHeaders } from '@libs/auth-shared-ts/client-request-auth';
import { createLiveRead } from '@pkgs/async-root-client-ts/live-read';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import type { JSX } from '@solidjs/web';
import { Match, Switch } from 'solid-js';
import { AdminSession } from './admin-session';

export function AdminAccess(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const env = useClientEnv();
  const auth = useClientRequestAuth();
  const signIn = useSignInModal();
  const signOut = useSignOutModal();
  const access = createLiveRead(
    () =>
      auth.sessionToken && auth.accountId && auth.deviceId
        ? { headers: clientAuthHeaders(auth), account: auth.accountId }
        : undefined,
    async ({ headers, account }) => {
      const result = await env.server(`${env.serverUrl}/api/admin/access`, {
        headers,
        cache: 'no-store',
      });
      if (result.status === 204) return { kind: 'allowed', account } as const;
      if (result.status === 401) return { kind: 'sign-in' } as const;
      if (result.status === 403) return { kind: 'denied' } as const;
      throw new Error('Could not check administration access.');
    }
  );
  const grantedAccount = (): string | undefined => {
    const latest = access.shown();
    return auth.sessionToken &&
      !access.loading() &&
      !access.failed() &&
      latest?.kind === 'allowed' &&
      latest.account === auth.accountId
      ? latest.account
      : undefined;
  };
  return (
    <Switch
      fallback={<LoadingState caption={<Trans>Checking access…</Trans>} />}
    >
      <Match
        when={
          !auth.sessionToken ||
          (!access.loading() &&
            !access.failed() &&
            access.shown()?.kind === 'sign-in')
        }
      >
        <ContentScreen
          screenId="admin-sign-in"
          breadcrumbs={[{ name: <Trans>Administration</Trans> }]}
        >
          <EmptyState
            title={<Trans>Sign in to Administration</Trans>}
            body={<Trans>Use the account that has administrator access.</Trans>}
            action={{ label: <Trans>Sign in</Trans>, onClick: signIn.open }}
          />
        </ContentScreen>
      </Match>
      <Match when={!access.loading() && access.failed()}>
        <ErrorState
          title={<Trans>Access could not be checked</Trans>}
          body={<Trans>Check your connection and try again.</Trans>}
          retry={{ onClick: () => void access.reread() }}
        />
      </Match>
      <Match when={!access.loading() && access.shown()?.kind === 'denied'}>
        <ContentScreen
          screenId="admin-denied"
          breadcrumbs={[{ name: <Trans>Administration</Trans> }]}
        >
          <EmptyState
            title={<Trans>Administrator access required</Trans>}
            body={
              <Trans>
                Sign out to use another account, or check again after your
                access changes.
              </Trans>
            }
            action={{ label: <Trans>Sign out</Trans>, onClick: signOut.open }}
            secondaryAction={{
              label: <Trans>Check again</Trans>,
              onClick: () => void access.reread(),
            }}
          />
        </ContentScreen>
      </Match>
      <Match when={grantedAccount()} keyed>
        {(account) => (
          <AdminSession account={account}>{props.children}</AdminSession>
        )}
      </Match>
    </Switch>
  );
}
