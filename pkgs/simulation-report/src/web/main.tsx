import { createRoot } from 'react-dom/client';

import { App } from './app';
import { loadPreviewFontCss, NUNITO_FONT_CSS_URL } from './preview-fonts';

// Warm Nunito once before first srcdoc frame (link + cached CSS text).
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = NUNITO_FONT_CSS_URL;
document.head.appendChild(fontLink);
void loadPreviewFontCss();

const root = document.getElementById('root');
if (root === null) throw new Error('#root missing');
createRoot(root).render(<App />);
