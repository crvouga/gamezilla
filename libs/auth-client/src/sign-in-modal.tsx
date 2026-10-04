/**
 * Hosted sign-in surface. Shown from the user menu / commands when the user
 * chooses Sign in.
 *
 * Idle flow is a method picker (Google, and Apple where enabled). Every
 * method uses an OAuth auth-session with a durable pending marker across the
 * redirect/popup handoff. A sign-in whose address matched another account
 * lands on "Connect your accounts" instead of an error.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { AuthLinkRequiredError } from '@pkgs/auth-client/auth-link-required-error';
import type { SignInOptions } from '@pkgs/auth-shared/auth-client-port';
import type { OauthProviderId } from '@pkgs/auth-shared/sign-in-method';
import { ErrorState } from '@pkgs/ui-client/error-state';
import { FadeSwitch } from '@pkgs/ui-client/fade-switch';
import { LoadingState } from '@pkgs/ui-client/loading-state';
import { ModalButton, ModalFooter } from '@pkgs/ui-client/modal-parts';
import { ResponsiveSurface } from '@pkgs/ui-client/responsive-surface';
import { SuccessState } from '@pkgs/ui-client/success-state';
import {
  type Accessor,
  createEffect,
  type JSX,
  Match,
  on,
  Show,
  Switch,
} from 'solid-js';
import { authFlowErrorMessage } from './auth-flow-messages';
import { SignInIdleBody, SignInIdleFooter } from './sign-in-idle-content';
import { SignInLinkRequiredContent } from './sign-in-link-required';
import type { SignInPhase } from './use-sign-in-modal-lifecycle';
import { useSignInModalLifecycle } from './use-sign-in-modal-lifecycle';

export type SignInModalProps = {
  visible: boolean;
  onClose: () => void;
  /** True when resuming a sign-in that began before an OAuth redirect. */
  resumePending: boolean;
  /** True while synced sign-in method flags are still loading. */
  methodsLoading?: boolean | undefined;
  /** Enabled sign-in methods, in display order. */
  providers: readonly OauthProviderId[];
  signInUnavailableReason: string | null;
  onSignIn: (
    provider: OauthProviderId,
    options?: SignInOptions
  ) => Promise<void>;
  /** Decline a pending link: the new sign-in becomes its own account. */
  onCreateSeparate: (pendingLinkToken: string) => Promise<void>;
  onError?: ((error: Error) => void) | undefined;
};

const STATE_AREA_MIN_HEIGHT = 200;

function useResetOnClose(args: {
  visible: () => boolean;
  phase: Accessor<SignInPhase>;
  reset: () => void;
}): void {
  const wasVisibleRef = { current: false };
  createEffect(
    on(
      args.visible,
      (visible) => {
        if (visible) {
          wasVisibleRef.current = true;
          return;
        }
        if (!wasVisibleRef.current) return;
        const phase = args.phase();
        if (phase === 'loading') return;
        if (phase === 'success') return;
        args.reset();
      },
      { defer: true }
    )
  );
}

export function SignInModal(props: SignInModalProps): JSX.Element {
  const { t } = useLingui();
  const lifecycle = useSignInModalLifecycle({
    resumePending: () => props.resumePending,
    onError: (error) => props.onError?.(error),
  });
  useResetOnClose({
    visible: () => props.visible,
    phase: lifecycle.phase,
    reset: lifecycle.reset,
  });

  const anyMethod = () => props.providers.length > 0;
  const trigger = <A extends unknown[]>(
    runner: (...args: A) => Promise<void>,
    ...args: A
  ): void => {
    if (!anyMethod() || lifecycle.phase() === 'loading') return;
    void lifecycle.start(() => runner(...args));
  };

  const dismissModal = () => {
    lifecycle.dismiss();
    props.onClose();
  };

  const surfaceClose = () => {
    if (lifecycle.phase() === 'loading' && !props.resumePending) return;
    dismissModal();
  };

  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={surfaceClose}
      title={t`Sign in`}
      presentation="modal"
      closeDataSet={{ testid: Handles.authModalClose }}
    >
      <FadeSwitch stateKey={lifecycle.phase()}>
        <SignInPhaseContent
          phase={lifecycle.phase}
          error={lifecycle.error}
          onClose={props.onClose}
          onDismiss={dismissModal}
          onRetry={lifecycle.reset}
          onProveLink={(provider, token) => {
            trigger(props.onSignIn, provider, { pendingLink: token });
          }}
          onSeparate={(token) => {
            trigger(props.onCreateSeparate, token);
          }}
          idleBody={
            <SignInIdleBody
              methodsLoading={props.methodsLoading}
              providers={props.providers}
              signInUnavailableReason={props.signInUnavailableReason}
              onPress={(provider) => {
                trigger(props.onSignIn, provider);
              }}
            />
          }
          idleFooter={<SignInIdleFooter onClose={props.onClose} />}
        />
      </FadeSwitch>
    </ResponsiveSurface>
  );
}

function SignInPhaseContent(props: {
  phase: Accessor<SignInPhase>;
  error: Accessor<Error | null>;
  onClose: () => void;
  onDismiss: () => void;
  onRetry: () => void;
  onProveLink: (provider: OauthProviderId, token: string) => void;
  onSeparate: (token: string) => void;
  idleBody: JSX.Element;
  idleFooter: JSX.Element;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Switch
      fallback={
        <>
          {props.idleBody}
          <ModalFooter>{props.idleFooter}</ModalFooter>
        </>
      }
    >
      <Match when={props.phase() === 'loading'}>
        <StateArea>
          <LoadingState caption={t`Signing in…`} />
        </StateArea>
      </Match>
      <Match when={props.phase() === 'success'}>
        <>
          <StateArea>
            <SuccessState
              title={t`Signed in`}
              body={t`You're signed in on this device.`}
            />
          </StateArea>
          <ModalFooter>
            <ModalButton
              label={t`Done`}
              onClick={props.onDismiss}
              dataSet={{ testid: Handles.authSignedInDone }}
            />
          </ModalFooter>
        </>
      </Match>
      <Match when={props.phase() === 'error'}>
        <Show
          when={linkRequiredOf(props.error())}
          fallback={
            <SignInErrorContent
              error={props.error}
              onClose={props.onClose}
              onRetry={props.onRetry}
            />
          }
        >
          {(link) => (
            <SignInLinkRequiredContent
              link={link()}
              onProve={(provider) => props.onProveLink(provider, link().token)}
              onSeparate={() => props.onSeparate(link().token)}
              onClose={props.onClose}
            />
          )}
        </Show>
      </Match>
    </Switch>
  );
}

function linkRequiredOf(error: Error | null): AuthLinkRequiredError | null {
  return error instanceof AuthLinkRequiredError ? error : null;
}

function SignInErrorContent(props: {
  error: Accessor<Error | null>;
  onClose: () => void;
  onRetry: () => void;
}): JSX.Element {
  const { i18n, t } = useLingui();
  const message = (): string | null => {
    const error = props.error();
    return error === null ? null : authFlowErrorMessage(i18n(), error);
  };
  return (
    <div class="box" data-testid={Handles.authSignInFailed}>
      <StateArea>
        <ErrorState
          title={t`Sign-in failed`}
          body={message() ?? t`Sign-in was cancelled or didn't finish.`}
          retry={{ label: t`Try again`, onClick: props.onRetry }}
        />
      </StateArea>
      <ModalFooter>
        <ModalButton
          label={t`Close`}
          variant="cancel"
          onClick={props.onClose}
        />
      </ModalFooter>
    </div>
  );
}

function StateArea(props: { children: JSX.Element }): JSX.Element {
  return (
    <div
      class="box justify-center"
      style={{ 'min-height': `${STATE_AREA_MIN_HEIGHT}px` }}
    >
      {props.children}
    </div>
  );
}
