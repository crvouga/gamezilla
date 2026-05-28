import { LoadingState } from '@pkgs/ui';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Web OAuth callback page intentionally avoids app providers / DB bootstrap.
 * `WebBrowser.maybeCompleteAuthSession()` in `polyfill-entry` completes handoff.
 */
export default function SsoCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)');
  }, [router]);
  return <LoadingState size="large" />;
}
