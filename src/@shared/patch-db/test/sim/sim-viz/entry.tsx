import { assert } from '@/@shared/assert';
import { createRoot } from 'react-dom/client';
import { App } from './app';

const el = document.getElementById('root');
assert.defined(el, 'sim viz: #root element');
const root = createRoot(el);
root.render(<App />);
