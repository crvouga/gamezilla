// @io-wall-ok
import './polyfill-entry';
import '@pkgs/ui/tokens.css';
import './styles.css';
import { render } from 'solid-js/web';
import { RootApp } from './root-app';
import { wallConsoleEnv } from './wall-console-env';

const root = document.getElementById('root');
if (root === null) throw new Error('Console root element is missing');
const dispose = render(() => <RootApp env={wallConsoleEnv()} />, root);
import.meta.hot?.dispose(dispose);
