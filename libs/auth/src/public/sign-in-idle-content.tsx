import { useLingui } from '@lingui/solid/macro';
import { ModalButton } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { SignInModalBody } from './sign-in-modal-body';

export function SignInIdleBody(props: {
  methodsLoading?: boolean | undefined;
  googleAvailable: boolean;
  devOauthAvailable: boolean;
  signInUnavailableReason: string | null;
  onPressGoogle: () => void;
  onPressDev: () => void;
}): JSX.Element {
  return (
    <SignInModalBody
      methodsLoading={props.methodsLoading}
      googleAvailable={props.googleAvailable}
      devOauthAvailable={props.devOauthAvailable}
      signInUnavailableReason={props.signInUnavailableReason}
      onPressGoogle={props.onPressGoogle}
      onPressDev={props.onPressDev}
    />
  );
}

export function SignInIdleFooter(props: { onClose: () => void }): JSX.Element {
  const { t } = useLingui();
  return (
    <ModalButton label={t`Close`} variant="cancel" onClick={props.onClose} />
  );
}
