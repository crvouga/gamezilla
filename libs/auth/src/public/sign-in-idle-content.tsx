import { useLingui } from '@lingui/react/macro';
import { ModalButton } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import { SignInModalBody } from './sign-in-modal-body';

export function SignInIdleBody(props: {
  methodsLoading?: boolean;
  googleAvailable: boolean;
  devOauthAvailable: boolean;
  signInUnavailableReason: string | null;
  onPressGoogle: () => void;
  onPressDev: () => void;
}): ReactNode {
  return <SignInModalBody {...props} />;
}

export function SignInIdleFooter(props: { onClose: () => void }): ReactNode {
  const { t } = useLingui();
  return (
    <ModalButton label={t`Close`} variant="cancel" onPress={props.onClose} />
  );
}
