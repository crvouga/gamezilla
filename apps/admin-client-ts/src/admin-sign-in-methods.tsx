import { useClientEnv } from '@libs/app-env-client-ts/client-env-context';
import { AuthModalsProvider } from '@libs/auth-client-ts/auth-modals-provider';
import { SignInCapabilitiesProvider } from '@libs/auth-client-ts/sign-in-capabilities-context';
import { createLiveRead } from '@pkgs/async-root-client-ts/live-read';
import { useHttpClient } from '@pkgs/http-client-client-ts/solid';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

export function AdminSignInMethods(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const http = useHttpClient();
  const env = useClientEnv();
  const methods = createLiveRead(
    () => env.serverUrl,
    async (origin) => {
      const result = await http.fetch(`${origin}/api/auth/providers`);
      if (!result.ok) throw new Error('Could not load sign-in methods.');
      const body: unknown = await result.json();
      if (
        typeof body !== 'object' ||
        body === null ||
        !('providers' in body) ||
        !Array.isArray(body.providers)
      ) {
        throw new Error('Unrecognized sign-in methods.');
      }
      return {
        google: body.providers.includes('google'),
        apple: body.providers.includes('apple'),
      };
    }
  );
  return (
    <Show
      when={!methods.failed()}
      fallback={
        <ErrorState
          title={<Trans>Sign-in methods are unavailable</Trans>}
          body={<Trans>Check your connection and try again.</Trans>}
          retry={{ onClick: () => void methods.reread() }}
        />
      }
    >
      <SignInCapabilitiesProvider
        value={{
          get google() {
            return methods.shown()?.google === true;
          },
          get apple() {
            return methods.shown()?.apple === true;
          },
          email: env.emailSignIn === true,
          get ready() {
            return methods.shown() !== undefined;
          },
        }}
      >
        <AuthModalsProvider>{props.children}</AuthModalsProvider>
      </SignInCapabilitiesProvider>
    </Show>
  );
}
