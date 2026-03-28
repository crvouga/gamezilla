import '@xyflow/react/dist/style.css';
import './main.css';

const ro = window.ResizeObserver;
window.ResizeObserver = class extends ro {
  constructor(cb: ResizeObserverCallback) {
    super((entries, observer) => {
      requestAnimationFrame(() => cb(entries, observer));
    });
  }
};

import { createRoot } from 'react-dom/client';
import { assert } from '../../assert';
import { BrowserCrashHandler } from '../../assert/crash/crash-handler/crash-handler-browser';
import { PlaygroundApp } from './playground-app';
assert.registerCrashHandler(new BrowserCrashHandler());
const el = document.getElementById('root');
assert.defined(el, 'patchdb-app: #root element');
const root = createRoot(el);
root.render(<PlaygroundApp />);
