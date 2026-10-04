/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import SsoCallbackRoute from '@libs/app-root-client/sso-callback';
import { AuthClientProvider } from '@libs/auth-client/auth-client-provider';
import { SIGN_IN_PENDING_KEY } from '@libs/auth-shared/auth-storage-keys';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import type { AuthClientPort } from '@pkgs/auth-root-shared/auth-client-port';
import type { AppRouter } from '@pkgs/ui-root-client/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client/app-router';
import { hrefToPath } from '@pkgs/ui-root-shared/href';
import { renderChrome } from './render-chrome';

const savedPending = localStorage.getItem(SIGN_IN_PENDING_KEY);

afterEach(() => {
  if (savedPending === null) localStorage.removeItem(SIGN_IN_PENDING_KEY);
  else localStorage.setItem(SIGN_IN_PENDING_KEY, savedPending);
});

test.each(['success', 'failure'] as const)(
  'the callback waits for %s before restoring the original screen',
  async (outcome) => {
    localStorage.setItem(
      SIGN_IN_PENDING_KEY,
      JSON.stringify({
        startedAt: '1970-01-01T00:00:00.000Z',
        returnHref: '/space/original?tab=players',
      })
    );
    const completion = Promise.withResolvers<undefined>();
    const calls: string[] = [];
    const port = {
      completeHostedAuthRedirect: () => {
        calls.push('exchange');
        return completion.promise;
      },
    } as unknown as AuthClientPort;
    const router: AppRouter = {
      push: () => {
        throw new Error('The callback must replace its history entry');
      },
      replace: (href) => calls.push(hrefToPath(href)),
      back: () => {
        throw new Error('The callback must restore the stored screen');
      },
      canGoBack: () => false,
    };
    renderChrome(() => (
      <I18nProvider i18n={i18n}>
        <AuthClientProvider port={port}>
          <StaticAppRouterProvider router={router}>
            <SsoCallbackRoute />
          </StaticAppRouterProvider>
        </AuthClientProvider>
      </I18nProvider>
    ));
    expect(calls).toEqual(['exchange']);
    // Resuming the modal can clear its marker as the exchange settles.
    localStorage.removeItem(SIGN_IN_PENDING_KEY);
    if (outcome === 'success') completion.resolve(undefined);
    else completion.reject(new Error('provider_failed'));
    await completion.promise.catch(() => undefined);
    await Promise.resolve();
    expect(calls).toEqual(['exchange', '/space/original?tab=players']);
  }
);
