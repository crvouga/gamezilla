import { Trans, useLingui } from '@lingui/react/macro';
import { DismissibleBanner } from '@pkgs/ui';
import { type ReactNode, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  type PwaUpdatePrompt,
  registerServiceWorker,
} from './register-service-worker';

/**
 * Top banner when a new Workbox-generated service worker is waiting.
 */
export function PwaUpdatePromptBanner(): ReactNode {
  const { t } = useLingui();
  const [prompt, setPrompt] = useState<PwaUpdatePrompt | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    return registerServiceWorker(setPrompt);
  }, []);

  if (Platform.OS !== 'web' || prompt === null) {
    return null;
  }

  return (
    <DismissibleBanner
      visible
      position="top"
      onDismiss={() => setPrompt(null)}
      title={<Trans>New version available — reload to update</Trans>}
      actionLabel={t`Reload`}
      onActionPress={() => prompt.reload()}
      testID="pwa-update-banner"
      dismissButtonTestID="pwa-update-banner-dismiss"
    />
  );
}
