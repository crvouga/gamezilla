// Polyfill must run before the app tree loads (may assert crypto).
import './src/polyfill-entry';
import { registerRootComponent } from 'expo';

import { App } from './src/app';

registerRootComponent(App);
