import './main.css';

import { assert } from '@/@shared/assert';
import { BrowserCrashHandler } from '@/@shared/assert/crash/crash-handler/crash-handler-browser';
import { createRoot } from 'react-dom/client';
import { PlaygroundApp } from './playground-app';
assert.registerCrashHandler(new BrowserCrashHandler());
const el = document.getElementById('root');
assert.defined(el, 'sim viz: #root element');
const root = createRoot(el);
root.render(<PlaygroundApp />);
