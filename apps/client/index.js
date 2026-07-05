// Polyfill must run before expo-router loads route modules (they may assert crypto).
import './src/polyfill-entry';
import './src/sentry-init';
import 'expo-router/entry';
