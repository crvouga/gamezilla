import { Handles } from '@libs/test-ids-shared/handles';
import { actorUi, pollUntil, scenarioAction } from './actor-ui';
import { dismissSignedIn, openSignInModal } from './auth-actions';
import type { ProductHarness } from './harness';
import { signedInAccountOf } from './identity';

export const setupPasswordAccount = scenarioAction({
  name: 'setupPasswordAccount',
  act: async (s, actor: string, email: string, password: string) => {
    await Promise.resolve(
      authenticateWithPassword.act(s, actor, {
        email,
        password,
        registering: true,
      })
    );
    await pollUntil(
      s,
      async () => (await signedInAccountOf(s, actor)) ?? null,
      { maxMs: 20_000, description: 'the password account is ready' }
    );
  },
});

export const authenticateWithPassword = scenarioAction({
  name: 'authenticateWithPassword',
  act: async (
    s,
    actor: string,
    credentials: { email: string; password: string; registering: boolean }
  ) => {
    const ui = await actorUi(s, actor);
    await openSignInModal(ui);
    await ui.get('auth-password-email').input(credentials.email);
    await ui.get('auth-password-secret').input(credentials.password);
    await ui
      .get(
        credentials.registering
          ? 'auth-password-register'
          : 'auth-password-sign-in'
      )
      .tap();
    const succeeded = await pollUntil(
      s,
      async () => {
        if (await ui.get(Handles.authSignedInDone).isVisible()) return true;
        if (await ui.get(Handles.authSignInFailed).isVisible()) return false;
        return null;
      },
      { maxMs: 20_000, description: 'password sign-in outcome' }
    );
    if (succeeded) await dismissSignedIn(ui);
  },
});

export async function passwordErrorShown(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  return (await actorUi(s, actor)).get(Handles.authSignInFailed).text();
}
