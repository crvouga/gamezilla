/**
 * Walking a provider's sign-in window the way a person does: the account
 * chooser, a new account when theirs is not listed, the consent card, and —
 * for Sign in with Apple — the hand-off page that posts the answer back to
 * the app (the browser runs no page scripts, so the person presses its
 * Continue, as a browser without JavaScript does). Google and Apple share the
 * screens; Apple's consent card adds "Share / Hide My Email".
 *
 * The screens are the simulated provider's own
 * (`@crvouga/mockingbird-service-oauth`), found by their `oauth-mock-*` test
 * ids.
 */

import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { pollUntil } from './actor-ui';
import { type ProductHarness, productExtra } from './harness';
import type { HarnessIdpProvider } from './idp';
import { harnessIdpAccountId } from './idp';

const WAIT_MS = 15_000;
/** Screens one sign-in can pass through (chooser → sign-up → consent → hand-off). */
const MAX_PROVIDER_STEPS = 8;

/** The simulated provider's `data-testid`s. */
const PROVIDER_PAGE = {
  chooser: 'oauth-mock-chooser',
  account: (accountId: string) => `oauth-mock-account-${accountId}`,
  createAccount: 'oauth-mock-create-account',
  signup: 'oauth-mock-signup',
  signupName: 'oauth-mock-signup-name',
  signupEmail: 'oauth-mock-signup-email',
  signupSubmit: 'oauth-mock-signup-submit',
  consent: 'oauth-mock-consent',
  allow: 'oauth-mock-allow',
  deny: 'oauth-mock-deny',
  hideEmail: 'oauth-mock-hide-email',
  shareEmail: 'oauth-mock-share-email',
  handoff: 'oauth-mock-form-post',
  handoffContinue: 'oauth-mock-form-post-continue',
} as const;

type ProviderScreen = 'chooser' | 'signup' | 'consent' | 'handoff';

const SCREENS: readonly (readonly [ProviderScreen, string])[] = [
  ['chooser', PROVIDER_PAGE.chooser],
  ['signup', PROVIDER_PAGE.signup],
  ['consent', PROVIDER_PAGE.consent],
  ['handoff', PROVIDER_PAGE.handoff],
];

const SCREEN_TEST_IDS: Readonly<Record<ProviderScreen, string>> =
  Object.fromEntries(SCREENS) as Record<ProviderScreen, string>;

/** How the person answers the provider. */
export type ProviderAnswers = {
  readonly provider: HarnessIdpProvider;
  readonly email: string;
  /** Apple's first authorization: share the real address or a relay. */
  readonly emailChoice?: 'share' | 'hide';
  readonly consent?: 'allow' | 'deny';
};

async function currentScreen(
  s: ProductHarness,
  ui: Driver,
  done: () => Promise<boolean>
): Promise<ProviderScreen | 'done'> {
  return await pollUntil<ProviderScreen | 'done'>(
    s,
    async () => {
      if (await done()) return 'done';
      for (const [screen, testId] of SCREENS) {
        if (await ui.get(testId).isVisible()) return screen;
      }
      return null;
    },
    { maxMs: WAIT_MS, description: 'a provider sign-in screen' }
  );
}

/** The chooser: this account's row, or a new account at this address. */
async function choose(ui: Driver, answers: ProviderAnswers): Promise<void> {
  const row = ui.get(PROVIDER_PAGE.account(harnessIdpAccountId(answers.email)));
  if (await row.isVisible()) {
    await row.tap({ timeoutMs: WAIT_MS });
    return;
  }
  await ui.get(PROVIDER_PAGE.createAccount).tap({ timeoutMs: WAIT_MS });
}

/** A new account at the person's address, named after it. */
async function signUp(ui: Driver, answers: ProviderAnswers): Promise<void> {
  const handle = answers.email.slice(0, answers.email.indexOf('@'));
  await ui.get(PROVIDER_PAGE.signupName).input(handle);
  await ui.get(PROVIDER_PAGE.signupEmail).input(answers.email);
  await ui.get(PROVIDER_PAGE.signupSubmit).tap({ timeoutMs: WAIT_MS });
}

async function consent(ui: Driver, answers: ProviderAnswers): Promise<void> {
  if (answers.consent === 'deny') {
    await ui.get(PROVIDER_PAGE.deny).tap({ timeoutMs: WAIT_MS });
    return;
  }
  const choice =
    answers.emailChoice === 'hide'
      ? PROVIDER_PAGE.hideEmail
      : PROVIDER_PAGE.shareEmail;
  const radio = ui.get(choice);
  if (answers.emailChoice !== undefined && (await radio.isVisible())) {
    await radio.tap({ timeoutMs: WAIT_MS });
  }
  await ui.get(PROVIDER_PAGE.allow).tap({ timeoutMs: WAIT_MS });
}

/** One screen of the provider, answered the way the person would. */
async function answer(
  ui: Driver,
  screen: ProviderScreen,
  answers: ProviderAnswers
): Promise<void> {
  if (screen === 'chooser') {
    await choose(ui, answers);
    return;
  }
  if (screen === 'signup') {
    await signUp(ui, answers);
    return;
  }
  if (screen === 'consent') {
    await consent(ui, answers);
    return;
  }
  await ui.get(PROVIDER_PAGE.handoffContinue).tap({ timeoutMs: WAIT_MS });
}

/**
 * Walk the provider's window in the actor's browser until `done` — the app
 * shows the outcome, or the window closed.
 */
export async function completeProviderSignIn(args: {
  readonly s: ProductHarness;
  readonly ui: Driver;
  readonly actorId: string;
  readonly answers: ProviderAnswers;
  readonly done: () => Promise<boolean>;
}): Promise<void> {
  const { s, ui } = args;
  for (let step = 0; step < MAX_PROVIDER_STEPS; step += 1) {
    const screen = await currentScreen(s, ui, args.done);
    if (screen === 'done') return;
    // Live browsers execute Apple's form-post script; clicking again replays state.
    if (screen !== 'handoff' || productExtra(s).ui.kind !== 'bun-webview')
      await answer(ui, screen, args.answers);
    // The step is a round trip to the provider: the next screen (or the
    // hand-off back to the app) replaces this one when it lands.
    await ui.get(SCREEN_TEST_IDS[screen]).expect.hidden({ timeoutMs: WAIT_MS });
  }
  throw new Error(
    `${args.actorId} never left the ${args.answers.provider} window`
  );
}
