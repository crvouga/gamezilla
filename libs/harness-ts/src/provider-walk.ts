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

type NativeProviderPage =
  | Exclude<ProviderScreen, 'handoff'>
  | 'document not ready'
  | 'app'
  | 'API relay'
  | 'other origin'
  | 'provider return'
  | 'unknown provider page';

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

type ProviderControls = Pick<Driver, 'get'>;

type ProviderWalk = {
  readonly s: ProductHarness;
  readonly ui: ProviderControls;
  readonly actorId: string;
  readonly answers: ProviderAnswers;
  readonly done: (ui: ProviderControls) => Promise<boolean>;
};

/** A native tab navigates through the provider and relay to a new app document. */
function nativeProviderTab({ s, actorId, answers }: ProviderWalk) {
  const { ui, http } = productExtra(s);
  if (ui.kind !== 'bun-webview' || http.kind !== 'stack') return null;
  const browser = s.actors.get(actorId)?.browser;
  if (!browser) throw new Error(`Missing browser for ${actorId}`);
  const provider = new URL(http.idpOrigins[answers.provider]).origin;
  const app = new URL(ui.webOrigin).origin;
  const page = async (timeoutMs: number): Promise<NativeProviderPage> => {
    const doc = await browser.readyDocument(timeoutMs);
    if (!doc) return 'document not ready';
    if (doc.origin === app) return 'app';
    if (doc.origin !== provider)
      return doc.origin === http.origin ? 'API relay' : 'other origin';
    // Only these Mockingbird documents wait for a person. The return page
    // immediately replaces itself (including Apple's automatic form POST).
    // Bun's Chrome backend preserves the DevTools JSON escape for the
    // title separator. WebKit returns the decoded character.
    switch (doc.title.replace(String.raw`\u00b7`, '·')) {
      case 'Choose an account · OAuth Emulator':
        return 'chooser';
      case 'Create account · OAuth Emulator':
        return 'signup';
      case 'Review access · OAuth Emulator':
        return 'consent';
      case 'Continue to your app · OAuth Emulator':
        return 'provider return';
      default:
        return 'unknown provider page';
    }
  };
  return { page, controls: browser.documentControls };
}

async function embeddedScreen(
  walk: ProviderWalk
): Promise<ProviderScreen | 'done' | null> {
  if (await walk.done(walk.ui)) return 'done';
  for (const [screen, testId] of SCREENS) {
    if (await walk.ui.get(testId).isVisible()) return screen;
  }
  return null;
}

/** A tab's URL may commit before its cached native title updates. */
async function visibleProviderForm(
  ui: ProviderControls,
  previous: ProviderScreen | null,
  waiting: (state: string) => null
) {
  for (const [form, id] of SCREENS) {
    // A native browser automatically submits Apple's hand-off document.
    if (form !== 'handoff' && (await ui.get(id).isVisible()))
      return form === previous ? waiting(`submitted ${form}`) : form;
  }
  if (await ui.get('oauth-mock-error').isVisible())
    throw new Error('The provider reports an expired sign-in');
  return waiting('unknown provider page without a visible form');
}

async function currentScreen(
  walk: ProviderWalk,
  tab: ReturnType<typeof nativeProviderTab>,
  previous: ProviderScreen | null
): Promise<ProviderScreen | 'done'> {
  if (!tab)
    return pollUntil(walk.s, () => embeddedScreen(walk), {
      maxMs: WAIT_MS,
      description: 'a provider sign-in screen',
    });
  // Keep only transitions, with no page titles or account details in the report.
  const observed: string[] = [];
  const waiting = (state: string): null => {
    if (state !== observed.at(-1)) {
      observed.push(state);
      if (observed.length > 4) observed.shift();
    }
    return null;
  };
  const description = () =>
    `a provider sign-in screen (${walk.actorId}, ${walk.answers.provider}, last submitted: ${previous ?? 'none'}; observed: ${observed.join(' → ') || 'none'})`;
  const probe = async (
    remainingMs: () => number
  ): Promise<ProviderScreen | 'done' | null> => {
    if (remainingMs() === 0) return null;
    const ui = tab.controls(remainingMs);
    const screen = await tab.page(remainingMs());
    if (screen === 'app')
      return (await walk.done(ui)) ? 'done' : waiting('app awaiting outcome');
    if (screen === 'unknown provider page')
      return visibleProviderForm(ui, previous, waiting);
    if (screen === previous) return waiting(`submitted ${screen}`);
    if (screen !== 'chooser' && screen !== 'signup' && screen !== 'consent')
      return waiting(screen);
    return (await ui.get(SCREEN_TEST_IDS[screen]).isVisible())
      ? screen
      : waiting(`${screen} marker absent`);
  };
  return pollUntil<ProviderScreen | 'done'>(
    walk.s,
    (remainingMs) =>
      probe(remainingMs).catch((cause: unknown) => {
        throw new Error(
          `${description()}: ${cause instanceof Error ? cause.message : String(cause)}`,
          { cause }
        );
      }),
    {
      maxMs: WAIT_MS,
      description: () => Promise.resolve(description()),
    }
  );
}

/** The chooser: this account's row, or a new account at this address. */
async function choose(
  ui: ProviderControls,
  answers: ProviderAnswers
): Promise<void> {
  const row = ui.get(PROVIDER_PAGE.account(harnessIdpAccountId(answers.email)));
  if (await row.isVisible()) {
    await row.tap({ timeoutMs: WAIT_MS });
    return;
  }
  await ui.get(PROVIDER_PAGE.createAccount).tap({ timeoutMs: WAIT_MS });
}

/** A new account at the person's address, named after it. */
async function signUp(
  ui: ProviderControls,
  answers: ProviderAnswers
): Promise<void> {
  const handle = answers.email.slice(0, answers.email.indexOf('@'));
  await ui.get(PROVIDER_PAGE.signupName).input(handle);
  await ui.get(PROVIDER_PAGE.signupEmail).input(answers.email);
  await ui.get(PROVIDER_PAGE.signupSubmit).tap({ timeoutMs: WAIT_MS });
}

async function consent(
  ui: ProviderControls,
  answers: ProviderAnswers
): Promise<void> {
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
  ui: ProviderControls,
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
export async function completeProviderSignIn(
  args: ProviderWalk
): Promise<void> {
  const { s } = args;
  const tab = nativeProviderTab(args);
  const ui = tab?.controls(() => WAIT_MS) ?? args.ui;
  let previous: ProviderScreen | null = null;
  for (let step = 0; step < MAX_PROVIDER_STEPS; step += 1) {
    const screen = await currentScreen(args, tab, previous);
    if (screen === 'done') return;
    // Live browsers execute Apple's form-post script; clicking again replays state.
    if (screen !== 'handoff' || productExtra(s).ui.kind !== 'bun-webview')
      await answer(ui, screen, args.answers);
    // The step is a round trip to the provider: the next screen (or the
    // hand-off back to the app) replaces this one when it lands.
    if (tab) previous = screen;
    else
      await ui
        .get(SCREEN_TEST_IDS[screen])
        .expect.hidden({ timeoutMs: WAIT_MS });
  }
  throw new Error(
    `${args.actorId} never left the ${args.answers.provider} window`
  );
}
