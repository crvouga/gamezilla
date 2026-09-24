/**
 * Walking a provider's sign-in window the way a person does: the address
 * step, the account chooser (a browser that signed in before), the password
 * step and the consent card — whichever the provider serves. Google and
 * Apple share the screens; Apple's first authorization adds the name and
 * "Share / Hide My Email" questions to the consent card.
 */

import {
  appleSubOf,
  IDP_PASSWORD,
  IDP_TEST_IDS,
  type IdpProviderKind,
  idpSubOf,
} from '@pkgs/idp-sim/shared';
import type { Driver } from '@pkgs/ui-testing';

import { pollUntil } from './actor-ui';
import type { ProductSim } from './sim';

const WAIT_MS = 15_000;
/** Screens one sign-in can pass through (chooser → identifier → password → consent). */
const MAX_PROVIDER_STEPS = 8;

type ProviderScreen = 'identifier' | 'chooser' | 'password' | 'consent';

const SCREENS: readonly (readonly [ProviderScreen, string])[] = [
  ['identifier', IDP_TEST_IDS.identifierPage],
  ['chooser', IDP_TEST_IDS.chooserPage],
  ['password', IDP_TEST_IDS.passwordPage],
  ['consent', IDP_TEST_IDS.consentPage],
];

const SCREEN_TEST_IDS: Readonly<Record<ProviderScreen, string>> =
  Object.fromEntries(SCREENS) as Record<ProviderScreen, string>;

/** How the person answers the provider. */
export type ProviderAnswers = {
  readonly provider: IdpProviderKind;
  readonly email: string;
  /** Apple's first authorization: share the real address or a relay. */
  readonly emailChoice?: 'share' | 'hide';
  readonly consent?: 'allow' | 'deny';
};

async function currentScreen(
  s: ProductSim,
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

function subOf(answers: ProviderAnswers): string {
  return answers.provider === 'apple'
    ? appleSubOf(answers.email)
    : idpSubOf(answers.email);
}

/** The chooser: this account's row, or "Use another account". */
async function choose(ui: Driver, answers: ProviderAnswers): Promise<void> {
  const row = ui.get(IDP_TEST_IDS.chooserAccount(subOf(answers)));
  if (await row.isVisible()) {
    await row.tap({ timeoutMs: WAIT_MS });
    return;
  }
  await ui.get(IDP_TEST_IDS.chooserUseAnother).tap({ timeoutMs: WAIT_MS });
}

async function consent(ui: Driver, answers: ProviderAnswers): Promise<void> {
  if (answers.consent === 'deny') {
    await ui.get(IDP_TEST_IDS.consentDeny).tap({ timeoutMs: WAIT_MS });
    return;
  }
  const hide = ui.get(IDP_TEST_IDS.consentHideEmail);
  if (answers.emailChoice === 'hide' && (await hide.isVisible())) {
    await hide.tap({ timeoutMs: WAIT_MS });
  }
  await ui.get(IDP_TEST_IDS.consentAllow).tap({ timeoutMs: WAIT_MS });
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
  if (screen === 'consent') {
    await consent(ui, answers);
    return;
  }
  if (screen === 'identifier') {
    await ui.get(IDP_TEST_IDS.identifierEmail).clear();
    await ui.get(IDP_TEST_IDS.identifierEmail).input(answers.email);
    await ui.get(IDP_TEST_IDS.identifierNext).tap({ timeoutMs: WAIT_MS });
    return;
  }
  await ui.get(IDP_TEST_IDS.passwordInput).input(IDP_PASSWORD);
  await ui.get(IDP_TEST_IDS.passwordNext).tap({ timeoutMs: WAIT_MS });
}

/**
 * Walk the provider's window in the actor's browser until `done` — the app
 * shows the outcome, or the window closed.
 */
export async function completeProviderSignIn(args: {
  readonly s: ProductSim;
  readonly ui: Driver;
  readonly actorId: string;
  readonly answers: ProviderAnswers;
  readonly done: () => Promise<boolean>;
}): Promise<void> {
  const { s, ui } = args;
  for (let step = 0; step < MAX_PROVIDER_STEPS; step += 1) {
    const screen = await currentScreen(s, ui, args.done);
    if (screen === 'done') return;
    await answer(ui, screen, args.answers);
    // The step is a round trip to the provider: the next screen (or the
    // hand-off back to the app) replaces this one when it lands.
    await ui.get(SCREEN_TEST_IDS[screen]).expect.hidden({ timeoutMs: WAIT_MS });
  }
  throw new Error(
    `${args.actorId} never left the ${args.answers.provider} window`
  );
}
