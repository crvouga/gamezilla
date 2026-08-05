import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type {
  RenderAdapter,
  RenderedApp,
} from '../../bootstrap/render-adapter';
import {
  clearElement,
  pressDomKey,
  scrollElement,
  tapElement,
  tapElementAt,
  typeIntoElement,
} from './dom-actions';
import {
  isElementVisible,
  queryElement,
  readElementText,
} from './query-element';

/**
 * RenderAdapter backed by react-dom + react-native-web (via Bun mock.module)
 * and @testing-library/dom. Requires happy-dom globals (see bun-preload.ts).
 */
export function createDomRenderAdapter(): RenderAdapter {
  return {
    async render(element: ReactElement): Promise<RenderedApp> {
      return mountDomApp(element);
    },
  };
}

async function mountDomApp(element: ReactElement): Promise<RenderedApp> {
  assertDomReady();
  enableReactActEnvironment();

  const container = document.createElement('div');
  container.setAttribute('data-ui-testing-root', 'true');
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(element);
  });

  return createRenderedApp(container, root);
}

function createRenderedApp(container: HTMLElement, root: Root): RenderedApp {
  return {
    query: (selector) => queryElement(container, selector),
    isVisible: isElementVisible,
    getText: readElementText,
    tap: (el) => act(async () => tapElement(el)),
    tapAt: (el, position) => act(async () => tapElementAt(el, position)),
    typeText: (el, text) => act(async () => typeIntoElement(el, text)),
    clearText: (el) => act(async () => clearElement(el)),
    pressKey: (key) => act(async () => pressDomKey(key)),
    scroll: (el, direction, amount) =>
      act(async () => scrollElement(el, direction, amount)),
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function assertDomReady(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error(
      'DOM globals missing. Preload @pkgs/ui-testing/drivers/in-process/bun-preload before running in-process tests.'
    );
  }
}

function enableReactActEnvironment(): void {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
}
