import { Box, Pressable, Text } from '@gamezilla/lib/ui';
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
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !google.available || submitting }}
        disabled={!google.available || submitting}
        onPress={onPressGoogle}
        sx={{
          py: 3,
          px: 3,
          borderRadius: 12,
          background: 'surface',
          opacity: !google.available || submitting ? 0.5 : 1,
        }}
      >
        <Text
          variant="bodyBold"
          label={submitting ? 'Signing in…' : 'Continue with Google'}
        />
        {!google.available && google.unavailableReason !== null ? (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary', mt: 2 }}
            label={google.unavailableReason}
          />
        ) : null}
      </Pressable>
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
