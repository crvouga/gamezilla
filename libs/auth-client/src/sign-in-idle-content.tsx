import { useLingui } from '@lingui/solid/macro';
import type { OauthProviderId } from '@pkgs/auth-shared/sign-in-method';
import { ModalButton } from '@pkgs/ui-client/modal-parts';
import type { JSX } from 'solid-js';
import { SignInModalBody } from './sign-in-modal-body';

export function SignInIdleBody(props: {
  methodsLoading?: boolean | undefined;
  providers: readonly OauthProviderId[];
  signInUnavailableReason: string | null;
  onPress: (provider: OauthProviderId) => void;
}): JSX.Element {
  return (
    <SignInModalBody
      methodsLoading={props.methodsLoading}
      providers={props.providers}
      signInUnavailableReason={props.signInUnavailableReason}
      onPress={props.onPress}
    />
  );
}

export function SignInIdleFooter(props: { onClose: () => void }): JSX.Element {
  const { t } = useLingui();
  return (
    <ModalButton label={t`Close`} variant="cancel" onClick={props.onClose} />
  );
}
