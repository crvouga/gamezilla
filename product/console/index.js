// Polyfill must run before the app tree loads (may assert crypto).
import './src/polyfill-entry';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import { RootApp } from './src/root-app';

registerRootComponent(RootApp);
