// Polyfill must run before expo-router loads route modules (they may assert crypto).
import './src/polyfill-entry';
import 'expo-router/entry';
