/**
 * `specs/auth/private-apple-email.qnt` against the example app: Dave (the
 * Apple directory's `dan@icloud.com`) on one device, signing in with Apple
 * while hiding or sharing his email address, and Apple stopping and
 * restarting mail forwarding from his private Apple email address. The
 * model's state is read back from what Dave's Apple sign-in method shows.
 */

import {
  appleRelayForwarding,
  signIn,
} from '@pkgs/auth-root-harness-ts/actions';
import { auth, identitiesOf } from '@pkgs/auth-root-harness-ts/system';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

import type { SignInTraceWorld } from './world';
import { traceAuth } from './world';

const DEVICE = 'c0';
const DAVE_APPLE = 'dan@icloud.com';

async function forwarding(w: SignInTraceWorld, on: boolean): Promise<void> {
  await traceAuth(w).apply(appleRelayForwarding, {
    email: DAVE_APPLE,
    forwarding: on,
  });
}

bindQuintModel<SignInTraceWorld>({
  model: 'private-apple-email',
  traces: 12,
  maxSteps: 8,
  actions: {
    init: async (w) => {
      w.harness = await auth.run({
        seed: w.ctx.testId,
        args: { fabric: 'mockingbird-sqlite', clientCount: 1 },
      });
    },
    signInWithApple: async (w, picks) => {
      await traceAuth(w).apply(signIn, {
        clientId: DEVICE,
        provider: 'apple',
        answers: {
          email: DAVE_APPLE,
          consent: 'allow',
          emailChoice: picks['hide'] === true ? 'hide' : 'share',
        },
      });
    },
    stopForwardingMail: async (w) => {
      await forwarding(w, false);
    },
    forwardMailAgain: async (w) => {
      await forwarding(w, true);
    },
    _phoneGoesOffline: () => Promise.resolve(),
    _phoneBackOnline: () => Promise.resolve(),
  },
  observe: async (w) => {
    const methods = await traceAuth(w).read(identitiesOf, DEVICE);
    const apple = methods.find((row) => row.provider === 'apple');
    const privateAddress = apple?.isPrivateEmail === true;
    return {
      privateAppleEmailAddress: privateAddress,
      mailNotForwarded: privateAddress && apple?.emailForwarding === false,
    };
  },
});
