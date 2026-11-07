// @io-wall-ok — owned live browser child process; private IPC only.
import { serveBrowserProcess } from '@pkgs/ui-testing-bun-webview-server-ts/browser-process-server';
import { openDevice } from './live-browser';

serveBrowserProcess(openDevice);
