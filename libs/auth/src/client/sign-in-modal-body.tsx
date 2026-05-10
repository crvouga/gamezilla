import { Box, ModalBody, SocialSignInButton, Text } from '@gamezilla/lib/ui';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type { HostedAuthUiPort } from './ports';

export function SignInModalBody(props: {
  hostedUi: HostedAuthUiPort;
  errorMessage: string | undefined;
  loading: boolean;
  onPressGoogle: () => void;
}) {
  const { hostedUi, errorMessage, loading, onPressGoogle } = props;
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
      <Box sx={{ marginTop: 3, alignSelf: 'stretch', gap: 2 }}>
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={<Trans>Choose a sign-in method</Trans>}
        />
        <SocialSignInButton
          provider="google"
          action="signIn"
          theme={'light' as const}
          onPress={onPressGoogle}
          loading={loading && hostedUi.available}
          disabled={!hostedUi.available}
        />
      </Box>
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
