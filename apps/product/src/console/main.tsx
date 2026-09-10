// @io-wall-ok
import { assert } from '@pkgs/assert';
import '@pkgs/tailwind/tailwind.css';
import '@pkgs/ui/tokens.css';
import '@pkgs/ui/base.css';
import { render } from 'solid-js/web';
import './polyfill-entry';
import { RootApp } from './root-app';
import './styles.css';
import { wallConsoleEnv } from './wall-console-env';

const root = document.getElementById('root');
assert.ok(root !== null, 'console root element is missing');
const env = wallConsoleEnv();
render(() => <RootApp env={env} />, root);
