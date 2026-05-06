import { ModalBody, Text } from '@gamezilla/lib/ui';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type { HostedAuthUiPort } from './ports';

export function SignInModalBody(props: {
  hostedUi: HostedAuthUiPort;
  errorMessage: string | undefined;
}) {
  const { hostedUi, errorMessage } = props;
  return (
    <ModalBody>
      <Text
        variant="body"
        label={
          <Trans>
            Sign in to link this device to your server user. Your data stays
            local first.
          </Trans>
        }
      />
      {!hostedUi.available ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={hostedUi.unavailableReason ?? t`Sign-in is not available.`}
        />
      ) : null}
      {typeof errorMessage === 'string' && errorMessage.length > 0 ? (
        <Text variant="caption" sx={{ color: 'error' }} label={errorMessage} />
      ) : null}
    </ModalBody>
  );
}
