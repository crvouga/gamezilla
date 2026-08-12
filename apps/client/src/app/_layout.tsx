import {
  ClientRootLayout,
  clientUnstableSettings,
} from '@apps/client/providers/client-root-layout';
import * as Sentry from '@sentry/react-native';
import 'react-native-reanimated';

import '@apps/client/polyfill-entry';

export const unstable_settings = clientUnstableSettings;

// Wrap always; Sentry.init runs after client_config sync (see AppObservabilityFromClientConfig).
export default Sentry.wrap(function RootLayout() {
  return <ClientRootLayout />;
});
