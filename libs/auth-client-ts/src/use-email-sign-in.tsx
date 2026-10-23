/**
 * State of the emailed-link form: ask for a link, then paste it.
 *
 * (`.tsx` so the Lingui macro is compiled by the Solid/Babel pipeline.)
 */

import { useLingui } from '@lingui/solid/macro';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { type Accessor, createEffect, createSignal, on } from 'solid-js';
import { useAuthClientPort } from './auth-client-provider';
import { authFlowErrorMessage } from './auth-flow-messages';

export type EmailSignInStep = 'address' | 'link';

export type EmailSignInParams = {
  /** The form starts over each time its surface opens. */
  visible: Accessor<boolean>;
  /** The sign-in lifecycle: shows "Signing in…" and the outcome. */
  start: (runner: () => Promise<void>) => Promise<void>;
  /** Set when signing in proves an existing account to attach a new method. */
  pendingLink: Accessor<string | null>;
};

export function useEmailSignIn(params: EmailSignInParams) {
  const { i18n, t } = useLingui();
  const port = useAuthClientPort();
  const [step, setStep] = createSignal<EmailSignInStep>('address');
  const [address, setAddress] = createSignal('');
  const [link, setLink] = createSignal('');
  const addressValid = () => /^\S+@\S+$/.test(address().trim());
  const request = useMutationButton({
    labels: {
      idle: t`Email me a link`,
      loading: t`Sending…`,
      success: t`Sent`,
      error: t`Try again`,
    },
    get disabled() {
      return !addressValid();
    },
    // The next step is this surface's own face, not a route.
    successHoldMs: 0,
    operation: async () => {
      const pendingLink = params.pendingLink();
      try {
        await port.requestEmailLink(
          address().trim(),
          pendingLink === null ? {} : { pendingLink }
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        throw new Error(authFlowErrorMessage(i18n(), err));
      }
    },
    onSuccess: () => setStep('link'),
  });
  const changeAddress = () => {
    setLink('');
    request.reset();
    setStep('address');
  };
  createEffect(
    on(params.visible, (visible) => {
      if (!visible) return;
      setAddress('');
      changeAddress();
    })
  );
  const signIn = () => {
    const pasted = link().trim();
    if (pasted.length === 0) return;
    // The link is spent by this attempt; it never stays in the form.
    setLink('');
    void params.start(() => port.signInWithEmailLink(pasted));
  };
  return {
    step,
    address,
    setAddress,
    link,
    setLink,
    request,
    linkPresent: () => link().trim().length > 0,
    changeAddress,
    signIn,
  };
}

export type EmailSignInForm = ReturnType<typeof useEmailSignIn>;
