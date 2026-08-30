import { useLingui } from '@lingui/react/macro';
import type { SignInCredentials } from '@pkgs/auth/shared/sign-in-strategy';
import { ModalButton } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { SignInDevBody } from './sign-in-dev-body';
import { SignInModalBody } from './sign-in-modal-body';

export type SignInIdleStep = 'methods' | 'dev';

export function titleForSignInIdleStep(
  step: SignInIdleStep,
  t: ReturnType<typeof useLingui>['t']
): string {
  if (step === 'dev') return t`Dev sign-in`;
  return t`Sign in`;
}

export function SignInIdleBody(props: {
  idleStep: SignInIdleStep;
  methodsLoading?: boolean;
  googleAvailable: boolean;
  devOauthAvailable: boolean;
  signInUnavailableReason: string | null;
  onPressGoogle: () => void;
  onPressDev: () => void;
  onSubmitDev: (credentials: SignInCredentials) => void;
}): ReactNode {
  const {
    idleStep,
    methodsLoading = false,
    googleAvailable,
    devOauthAvailable,
    signInUnavailableReason,
    onPressGoogle,
    onPressDev,
    onSubmitDev,
  } = props;

  if (idleStep === 'dev') {
    return <SignInDevBody onSubmit={onSubmitDev} />;
  }
  return (
    <SignInModalBody
      methodsLoading={methodsLoading}
      googleAvailable={googleAvailable}
      devOauthAvailable={devOauthAvailable}
      signInUnavailableReason={signInUnavailableReason}
      onPressGoogle={onPressGoogle}
      onPressDev={onPressDev}
    />
  );
}

export function SignInIdleFooter(props: {
  idleStep: SignInIdleStep;
  onClose: () => void;
  onBackToMethods: () => void;
}): ReactNode {
  const { t } = useLingui();
  if (props.idleStep === 'methods') {
    return (
      <ModalButton label={t`Close`} variant="cancel" onPress={props.onClose} />
    );
  }
  return (
    <ModalButton
      label={t`Back`}
      variant="cancel"
      onPress={props.onBackToMethods}
    />
  );
}
