// Polyfill must run before expo-router loads route modules (they may assert crypto).
import './src/polyfill-entry';
// Web dev only — must run before React (see react-scan-entry.web.ts).
import './src/dev/react-scan-entry';
import 'expo-router/entry';
