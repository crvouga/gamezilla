import { useLingui } from '@lingui/react/macro';
import type { SignInCredentials } from '@pkgs/auth/shared/sign-in-strategy';
import { ModalButton } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { SignInEmailSignInBody } from './sign-in-email-sign-in-body';
import { SignInEmailSignUpBody } from './sign-in-email-sign-up-body';
import { SignInModalBody } from './sign-in-modal-body';

export type SignInIdleStep = 'methods' | 'email-sign-in' | 'email-sign-up';

export function titleForSignInIdleStep(
  step: SignInIdleStep,
  t: ReturnType<typeof useLingui>['t']
): string {
  if (step === 'email-sign-up') return t`Create account`;
  return t`Sign in`;
}

export function SignInIdleBody(props: {
  idleStep: SignInIdleStep;
  methodsLoading?: boolean;
  googleAvailable: boolean;
  emailPasswordAvailable: boolean;
  signInUnavailableReason: string | null;
  onPressGoogle: () => void;
  onPressEmail: () => void;
  onSubmitEmail: (credentials: SignInCredentials) => void;
  onGoToSignUp: () => void;
  onGoToSignIn: () => void;
}): ReactNode {
  const {
    idleStep,
    methodsLoading = false,
    googleAvailable,
    emailPasswordAvailable,
    signInUnavailableReason,
    onPressGoogle,
    onPressEmail,
    onSubmitEmail,
    onGoToSignUp,
    onGoToSignIn,
  } = props;

  if (idleStep === 'email-sign-in') {
    return (
      <SignInEmailSignInBody
        onSubmit={onSubmitEmail}
        onGoToSignUp={onGoToSignUp}
      />
    );
  }
  if (idleStep === 'email-sign-up') {
    return (
      <SignInEmailSignUpBody
        onSubmit={onSubmitEmail}
        onGoToSignIn={onGoToSignIn}
      />
    );
  }
  return (
    <SignInModalBody
      methodsLoading={methodsLoading}
      googleAvailable={googleAvailable}
      emailPasswordAvailable={emailPasswordAvailable}
      signInUnavailableReason={signInUnavailableReason}
      onPressGoogle={onPressGoogle}
      onPressEmail={onPressEmail}
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
