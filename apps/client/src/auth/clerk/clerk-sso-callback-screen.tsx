/**
 * OAuth return path for hosted `useSSO` — see `clerk-sso-redirect.ts`.
 *
 * When client config has not synced yet, {@link clerkPublishableKeyAtom} is
 * empty and the tree renders without {@link ClerkProvider}; we must not call
 * Clerk's `useAuth` until the key exists and the provider wraps this route.
 */
import { useAuth } from '@clerk/clerk-expo';
import { clerkPublishableKeyAtom } from '../auth-atoms';
import { Box, Text } from '@gamezilla/lib/ui';
import { useRouter } from 'expo-router';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';

function SsoCallbackAwaitingHostedConfig() {
  const router = useRouter();

  useEffect(() => {
    const id = setTimeout(() => router.replace('/(tabs)'), 10_000);
    return () => clearTimeout(id);
  }, [router]);

  return (
    <Box
      sx={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        p: 4,
      }}
    >
      <ActivityIndicator size="large" />
      <Text
        variant="body"
        label={<Trans>Loading sign-in configuration…</Trans>}
      />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={t`If this takes too long, check client config sync and try again.`}
      />
    </Box>
  );
}

function SsoCallbackHostedBody() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [showStaleHint, setShowStaleHint] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (!isLoaded) return undefined;
    if (isSignedIn) {
      router.replace('/(tabs)');
      return undefined;
    }
    const staleId = setTimeout(() => setShowStaleHint(true), 2000);
    const exitId = setTimeout(() => router.replace('/(tabs)'), 5000);
    timeoutsRef.current.push(staleId, exitId);
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [isLoaded, isSignedIn, router]);

  return (
    <Box
      sx={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        p: 4,
      }}
    >
      <ActivityIndicator size="large" />
      <Text
        variant="body"
        label={
          showStaleHint ? (
            <Trans>Still working… you will be redirected shortly.</Trans>
          ) : (
            <Trans>Finishing sign-in…</Trans>
          )
        }
      />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={t`If this screen stays open, go back and try again.`}
      />
    </Box>
  );
}

export function ClerkSsoCallbackScreen() {
  const clerkPk = useAtomValue(clerkPublishableKeyAtom);
  const hasHostedConfig =
    typeof clerkPk === 'string' && clerkPk.trim().length > 0;

  if (!hasHostedConfig) {
    return <SsoCallbackAwaitingHostedConfig />;
  }

  return <SsoCallbackHostedBody />;
}
