import './main.css';

import { createRoot } from 'react-dom/client';
import { assert } from '@gamezilla/shared/assert';
import { BrowserCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-browser';
import { PlaygroundApp } from './playground-app';
assert.registerCrashHandler(new BrowserCrashHandler());
const el = document.getElementById('root');
assert.defined(el, 'patch-db-app: #root element');
const root = createRoot(el);
root.render(<PlaygroundApp />);
