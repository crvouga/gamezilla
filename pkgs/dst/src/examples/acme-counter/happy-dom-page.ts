import { Window } from 'happy-dom';
import { counterAppHtml } from './counter-app-html';
import type { Page } from './page';

async function mount(window: Window): Promise<void> {
  const doc = window.document;
  doc.open();
  doc.write(counterAppHtml);
  doc.close();
  // happy-dom does not auto-run inline <script> from document.write
  for (const script of doc.querySelectorAll('script')) {
    const type = script.getAttribute('type');
    if (type === 'module' || type === 'importmap') continue;
    const source = script.textContent ?? '';
    if (source.trim().length === 0) continue;
    window.eval(source);
  }
  await window.happyDOM.waitUntilComplete();
}

export async function openHappyDomPage(): Promise<Page> {
  const errors: string[] = [];
  const window = new Window({ url: 'http://127.0.0.1/' });
  const originalError = window.console.error.bind(window.console);
  window.console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
    originalError(...args);
  };

  await mount(window);
  const doc = window.document;

  return {
    async click(selector) {
      const el = doc.querySelector(selector);
      if (el === null) throw new Error(`missing ${selector}`);
      (el as unknown as { click(): void }).click();
      await window.happyDOM.waitUntilComplete();
    },
    async text(selector) {
      const el = doc.querySelector(selector);
      if (el === null) throw new Error(`missing ${selector}`);
      return (el.textContent ?? '').trim();
    },
    async routeAttr() {
      return doc.querySelector('#app')?.getAttribute('data-screen') ?? null;
    },
    async reload() {
      await mount(window);
    },
    consoleErrors() {
      return errors;
    },
    async dispose() {
      window.happyDOM.abort();
      await window.happyDOM.close();
    },
  };
}
