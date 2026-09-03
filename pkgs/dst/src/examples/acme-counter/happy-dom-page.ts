import { Window } from 'happy-dom';
import { COUNTER_MARKUP, COUNTER_SCRIPT } from './html';
import type { Page } from './page';

export async function openHappyDomPage(): Promise<Page> {
  const errors: string[] = [];
  const window = new Window({ url: 'http://127.0.0.1/' });
  const doc = window.document;
  const originalError = window.console.error.bind(window.console);
  window.console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
    originalError(...args);
  };

  doc.body.innerHTML = COUNTER_MARKUP;
  window.eval(COUNTER_SCRIPT);
  await window.happyDOM.waitUntilComplete();

  const remount = async () => {
    doc.body.innerHTML = COUNTER_MARKUP;
    window.eval(COUNTER_SCRIPT);
    await window.happyDOM.waitUntilComplete();
  };

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
      await remount();
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
