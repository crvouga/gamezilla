// Polyfill must run before the app tree loads (may assert crypto).
import './src/polyfill-entry';
// Optional WDYR (EXPO_PUBLIC_WDYR=1) — must patch React before RootApp.
import './src/dev/wdyr-dev';
import { registerRootComponent } from 'expo';

import { RootApp } from './src/root-app';

registerRootComponent(RootApp);
