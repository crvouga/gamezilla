import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { completeProviderSignIn } from '@libs/harness-ts/provider-walk';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

const google = 'http://google.test';
const app = 'http://app.test';

function signup(rejection?: string) {
  let phase: 'chooser' | 'signup' | 'submitted' | 'consent' | 'app' = 'chooser';
  const taps: string[] = [];
  const inputs: string[] = [];
  const ui = {
    get: (id: string) => ({
      attribute: async () => null,
      isVisible: async () => id === 'oauth-mock-' + phase,
      input: async (value: string) => {
        inputs.push(value);
      },
      text: async () => {
        expect(id).toBe('oauth-mock-signup-error');
        return rejection ?? null;
      },
      tap: async () => {
        taps.push(id);
        if (id === 'oauth-mock-create-account') phase = 'signup';
        if (id === 'oauth-mock-signup-submit') phase = 'submitted';
        if (id === 'oauth-mock-allow') phase = 'app';
      },
    }),
    visibleRegion: async () =>
      phase === 'consent' ? 'oauth-mock-consent' : 'oauth-mock-signup',
  };
  const browser = {
    documentControls: () => ui,
    readyDocument: async () =>
      phase === 'app'
        ? { origin: app, title: 'Account' }
        : {
            origin: google,
            title:
              phase === 'chooser'
                ? 'Choose an account · OAuth Emulator'
                : 'Create account · OAuth Emulator',
          },
  };
  const s = {
    actors: new Map([['alice', { browser }]]),
    session: {
      ports: {
        ui: { kind: 'bun-webview', webOrigin: app },
        http: { kind: 'stack', idpOrigins: { google } },
      },
      scheduler: { virtual: true, starvedAdvances: () => 0 },
      advanceTime: async () => {
        if (phase === 'submitted' && !rejection) phase = 'consent';
      },
      waitForIdle: async () => {},
    },
  } as unknown as ProductHarness;
  const result = completeProviderSignIn({
    s,
    ui: ui as unknown as Driver,
    actorId: 'alice',
    answers: { provider: 'google', email: 'alice@example.com' },
    done: async () => phase === 'app',
  });
  return { result, taps, inputs };
}

test('an unlisted Google account signs up once and consents while the native title still reads signup', async () => {
  const { result, taps, inputs } = signup();
  await result;
  expect(inputs).toEqual(['alice', 'alice@example.com']);
  expect(taps).toEqual([
    'oauth-mock-create-account',
    'oauth-mock-signup-submit',
    'oauth-mock-allow',
  ]);
});

test.each([
  [
    'This email already has an account. Go back to choose it.',
    'this email already has an account',
  ],
  [
    'Enter a full name and a valid email address.',
    'the submitted signup details',
  ],
])(
  'a rejected signup reports its provider verdict without submitting again',
  async (alert, reason) => {
    const { result, taps } = signup(alert);
    await expect(result).rejects.toThrow(reason);
    expect(taps).toEqual([
      'oauth-mock-create-account',
      'oauth-mock-signup-submit',
    ]);
  }
);
