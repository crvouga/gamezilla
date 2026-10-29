/** @jsxImportSource solid-js */
/** Email sign-in exists for Synthetic Users alone: a person is never offered it. */

import { afterEach, describe, expect, test } from 'bun:test';
import { createInMemoryClientPorts } from '@libs/app-root-client-ts/in-memory-client-ports';
import { createOfflineNetworkController } from '@libs/app-root-client-ts/offline-network-controller';
import { wallClientEnv } from '@libs/app-root-client-ts/wall-client-env';
import {
  type SignInCapabilities,
  SignInCapabilitiesProvider,
} from '@libs/auth-client-ts/sign-in-capabilities-context';
import { SignInLinkRequiredContent } from '@libs/auth-client-ts/sign-in-link-required';
import { SignInModalBody } from '@libs/auth-client-ts/sign-in-modal-body';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import type { OauthProviderId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import { KvImplInMemory } from '@pkgs/kv-root-shared-ts/impl-in-memory';
import { cleanup, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { renderChrome } from './render-chrome';

afterEach(cleanup);

const PERSON: SignInCapabilities = {
  google: true,
  apple: true,
  email: false,
  ready: true,
};

function renderWith(
  capabilities: SignInCapabilities,
  ui: () => JSX.Element
): void {
  renderChrome(() => (
    <I18nProvider i18n={i18n}>
      <SignInCapabilitiesProvider value={capabilities}>
        {ui()}
      </SignInCapabilitiesProvider>
    </I18nProvider>
  ));
}

function signInBody(providers: readonly OauthProviderId[]): () => JSX.Element {
  return () => (
    <SignInModalBody
      providers={providers}
      signInUnavailableReason={null}
      onPress={() => undefined}
      onContinueWithEmail={() => undefined}
    />
  );
}

type LinkRequired = Parameters<typeof SignInLinkRequiredContent>[0]['link'];

/** A Google sign-in whose address matched an account that also has email. */
const MATCHED_ACCOUNT: LinkRequired = Object.assign(
  new Error('auth: link_required'),
  {
    token: 'pending-link',
    email: 'a•••@example.test',
    provider: 'google' as const,
    providers: ['email', 'google'] as const,
  }
);

function connectAccounts(): JSX.Element {
  return (
    <SignInLinkRequiredContent
      link={MATCHED_ACCOUNT}
      onProve={() => undefined}
      onSeparate={() => undefined}
      onClose={() => undefined}
      onContinueWithEmail={() => undefined}
    />
  );
}

describe('a person choosing how to sign in', () => {
  test('sees the caption, Google and Apple, and no email', () => {
    renderWith(PERSON, signInBody(['google', 'apple']));
    expect(screen.getByText('Choose a sign-in method')).toBeTruthy();
    expect(screen.getByTestId(Handles.authMethodGoogle)).toBeTruthy();
    expect(screen.getByTestId(Handles.authMethodApple)).toBeTruthy();
    expect(screen.queryByTestId(Handles.authMethodEmail)).toBeNull();
    expect(screen.queryByText('Continue with email')).toBeNull();
  });

  test('is told sign-in is not available when no provider is enabled', () => {
    renderWith({ ...PERSON, google: false, apple: false }, signInBody([]));
    expect(screen.getByText('Sign-in is not available.')).toBeTruthy();
    expect(screen.queryByText('Choose a sign-in method')).toBeNull();
    expect(screen.queryByTestId(Handles.authMethodEmail)).toBeNull();
  });

  test('is not offered email to connect accounts, even when the matched account has it', () => {
    renderWith(PERSON, connectAccounts);
    expect(screen.getByTestId(Handles.authLinkWith('google'))).toBeTruthy();
    expect(screen.queryByTestId(Handles.authMethodEmail)).toBeNull();
  });
});

describe("a Synthetic User's application host", () => {
  const SYNTHETIC: SignInCapabilities = { ...PERSON, email: true };

  test('offers email beside the providers', () => {
    renderWith(SYNTHETIC, signInBody(['google']));
    expect(screen.getByTestId(Handles.authMethodEmail)).toBeTruthy();
    expect(screen.getByTestId(Handles.authMethodGoogle)).toBeTruthy();
  });

  test('offers email before any provider is known', () => {
    renderWith(
      { ...SYNTHETIC, google: false, apple: false, ready: false },
      () => (
        <SignInModalBody
          methodsLoading
          providers={[]}
          signInUnavailableReason={null}
          onPress={() => undefined}
          onContinueWithEmail={() => undefined}
        />
      )
    );
    expect(screen.getByTestId(Handles.authMethodEmail)).toBeTruthy();
    expect(screen.queryByText('Sign-in is not available.')).toBeNull();
  });

  test('offers email to connect accounts', () => {
    renderWith(SYNTHETIC, connectAccounts);
    expect(screen.getByTestId(Handles.authMethodEmail)).toBeTruthy();
  });
});

test("the environment people's browser and native apps run never turns email sign-in on", () => {
  const env = wallClientEnv({
    serverUrl: 'https://api.example.test',
    offline: createOfflineNetworkController(new KvImplInMemory()),
    objectStore: createInMemoryClientPorts().objectStore,
    room: () => {
      throw new Error('This check opens no room');
    },
  });
  expect(env.emailSignIn).toBeUndefined();
  expect('emailSignIn' in env).toBe(false);
});
