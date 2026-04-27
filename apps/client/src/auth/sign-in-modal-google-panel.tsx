import { Box, SocialSignInButton, Text } from '@gamezilla/lib/ui';
import type { AuthGoogleProviderState } from './auth-capabilities';

export type SignInGooglePanelProps = {
  google: AuthGoogleProviderState;
  submitting: boolean;
  errorMessage: string | null;
  onPressGoogle: () => void;
};

export function SignInGooglePanel({
  google,
  submitting,
  errorMessage,
  onPressGoogle,
}: SignInGooglePanelProps) {
  return (
    <Box sx={{ mt: 4, gap: 3 }}>
      <SocialSignInButton
        provider="google"
        action="continue"
        onPress={onPressGoogle}
        disabled={!google.available}
        loading={submitting}
      />
      {!google.available && google.unavailableReason !== null ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={google.unavailableReason}
        />
      ) : null}
      {errorMessage !== null ? (
        <Text
          variant="caption"
          sx={{ color: 'destructive' }}
          label={errorMessage}
        />
      ) : null}
    </Box>
  );
}
