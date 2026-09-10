/**
 * Hosted sign-in surface. Shown from the user menu / commands when the user
 * chooses Sign in.
 *
 * Idle flow is a method picker. Google and Dev both use OAuth auth-session
 * with a durable pending marker across redirect/popup handoff.
 */

import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import {
  ErrorState,
  FadeSwitch,
  LoadingState,
  ModalButton,
  ModalFooter,
  ResponsiveSurface,
  SuccessState,
} from '@pkgs/ui';
import {
  type Accessor,
  createEffect,
  type JSX,
  Match,
  on,
  Switch,
} from 'solid-js';
import { SignInIdleBody, SignInIdleFooter } from './sign-in-idle-content';
import {
  type SignInPhase,
  useSignInModalLifecycle,
} from './use-sign-in-modal-lifecycle';

export type SignInModalProps = {
  visible: boolean;
  onClose: () => void;
  /** True when resuming a sign-in that began before an OAuth redirect. */
  resumePending: boolean;
  /** True while synced sign-in method flags are still loading. */
  methodsLoading?: boolean | undefined;
  googleAvailable: boolean;
  devOauthAvailable: boolean;
  signInUnavailableReason: string | null;
  onSignInWithGoogle: () => Promise<void>;
  onSignInWithDev: () => Promise<void>;
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
    ...(props.onError !== undefined ? { onError: props.onError } : {}),
  });
  useResetOnClose({
    visible: () => props.visible,
    phase: lifecycle.phase,
    reset: lifecycle.reset,
  });

  const anyMethod = () => props.googleAvailable || props.devOauthAvailable;
  const trigger = (runner: () => Promise<void>) => {
    if (!anyMethod() || lifecycle.phase() === 'loading') return;
    void lifecycle.start(runner);
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
          idleBody={
            <SignInIdleBody
              methodsLoading={props.methodsLoading}
              googleAvailable={props.googleAvailable}
              devOauthAvailable={props.devOauthAvailable}
              signInUnavailableReason={props.signInUnavailableReason}
              onPressGoogle={() => {
                trigger(props.onSignInWithGoogle);
              }}
              onPressDev={() => {
                trigger(props.onSignInWithDev);
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
        <SignInErrorContent
          error={props.error}
          onClose={props.onClose}
          onRetry={props.onRetry}
        />
      </Match>
    </Switch>
  );
}

function SignInErrorContent(props: {
  error: Accessor<Error | null>;
  onClose: () => void;
  onRetry: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <StateArea>
        <ErrorState
          title={t`Sign-in failed`}
          body={
            props.error()?.message ?? t`Sign-in was cancelled or didn't finish.`
          }
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
    </>
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
