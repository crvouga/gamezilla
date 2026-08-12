import {
  act,
  fireEvent,
  type RenderResult,
  render,
  userEvent,
} from '@testing-library/react-native';
import type { ReactElement } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';

import type {
  HostNode,
  RenderAdapter,
  RenderedApp,
} from '../../bootstrap/render-adapter';
import type { Selector } from '../../selector/selector';
import { serializeHostTreeHtml } from './serialize-host-tree-html';

type RntlUser = ReturnType<typeof userEvent.setup>;

export type CreateRenderedAppFromRntlOptions = {
  readonly user?: RntlUser;
  /**
   * Re-assert this tree as the active RNTL root before pointer/keyboard
   * interactions. Required when multiple in-process actors are mounted.
   */
  readonly activate?: () => void | Promise<void>;
};

/**
 * Build a {@link RenderedApp} from an already-mounted RNTL tree
 * (e.g. `expo-router/testing-library` `renderRouter`).
 *
 * Queries go through the live {@link RenderResult} helpers (not a captured
 * root instance) so React state updates do not leave a stale fiber handle.
 */
export function createRenderedAppFromRntl(
  result: RenderResult,
  options: CreateRenderedAppFromRntlOptions = {}
): RenderedApp {
  const user = options.user ?? userEvent.setup({ delay: 0 });
  const app: RenderedApp = {
    query: (selector) => queryNode(result, selector),
    isVisible: (element) => isHostVisible(asInstance(element)),
    getText: (element) => readHostText(asInstance(element)),
    tap: async (element) => {
      fireEvent.press(asInstance(element));
    },
    tapAt: async (element) => {
      fireEvent.press(asInstance(element));
    },
    typeText: async (element, text) => {
      // Paste-shaped event sequence without user.paste's timer wait (can stall
      // ~15s under Jest). Includes `change` + `changeText` like RNTL paste.
      const target = findHostTextInput(asInstance(element));
      await act(async () => {
        fireEvent(target, 'focus');
        fireEvent(target, 'change', {
          nativeEvent: { text, target: 0 },
        });
        fireEvent.changeText(target, text);
        fireEvent(target, 'endEditing', {
          nativeEvent: { text, target: 0 },
        });
        fireEvent(target, 'blur');
      });
    },
    clearText: async (element) => {
      const target = findHostTextInput(asInstance(element));
      await act(async () => {
        fireEvent(target, 'focus');
        fireEvent(target, 'change', {
          nativeEvent: { text: '', target: 0 },
        });
        fireEvent.changeText(target, '');
        fireEvent(target, 'endEditing', {
          nativeEvent: { text: '', target: 0 },
        });
        fireEvent(target, 'blur');
      });
    },
    pressKey: async () => {
      // Keyboard keys are DOM-oriented; no-op under RNTL host trees.
    },
    scroll: async (element, direction, amount) => {
      const instance = asInstance(element);
      if (direction === 'down' || direction === 'up') {
        const y = direction === 'down' ? amount : -amount;
        await user.scrollTo(instance, { y });
        return;
      }
      const x = direction === 'right' ? amount : -amount;
      await user.scrollTo(instance, { x });
    },
    unmount: () => result.unmount(),
    snapshotHtml: () => serializeHostTreeHtml(result.toJSON()),
  };
  if (options.activate !== undefined) {
    app.activate = options.activate;
  }
  return app;
}

/**
 * RenderAdapter backed by React Native Testing Library v13
 * (`@testing-library/react-native` + `react-test-renderer`).
 * No DOM remapping and no `mock.module`.
 */
export function createRntlRenderAdapter(): RenderAdapter {
  return {
    async render(element: ReactElement): Promise<RenderedApp> {
      const user = userEvent.setup({ delay: 0 });
      const result = render(element);
      return createRenderedAppFromRntl(result, {
        user,
        activate: () => {
          // Rerender makes this root the latest so pointer events apply.
          result.rerender(element);
        },
      });
    },
  };
}

function asInstance(node: HostNode): ReactTestInstance {
  return node as ReactTestInstance;
}

/** Walk to a host that implements `onChangeText` (label hits the wrapper). */
function findHostTextInput(instance: ReactTestInstance): ReactTestInstance {
  if (typeof instance.props['onChangeText'] === 'function') {
    return instance;
  }
  for (const child of instance.children) {
    if (typeof child === 'string') continue;
    try {
      return findHostTextInput(child as ReactTestInstance);
    } catch {
      // keep searching siblings
    }
  }
  throw new Error('typeText: no onChangeText host under matched element');
}

function queryNode(scope: RenderResult, selector: Selector): HostNode | null {
  const matches = queryAll(scope, selector);
  const index = selector.nth ?? 0;
  return matches[index] ?? null;
}

function queryAll(
  scope: RenderResult,
  selector: Selector
): ReactTestInstance[] {
  switch (selector.kind) {
    case 'testId':
      return scope.queryAllByTestId(selector.value);
    case 'text':
      return scope.queryAllByText(selector.value, {
        exact: selector.exact !== false,
      });
    case 'label':
      return scope.queryAllByLabelText(selector.value);
    case 'role':
      return selector.name !== undefined
        ? scope.queryAllByRole(selector.role, { name: selector.name })
        : scope.queryAllByRole(selector.role);
  }
}

function isHostVisible(element: ReactTestInstance): boolean {
  let current: ReactTestInstance | null = element;
  while (current) {
    const props = current.props as {
      style?: unknown;
      pointerEvents?: string;
      accessibilityElementsHidden?: boolean;
      importantForAccessibility?: string;
    };
    if (props.accessibilityElementsHidden === true) return false;
    if (props.importantForAccessibility === 'no-hide-descendants') return false;
    if (props.pointerEvents === 'none') return false;
    if (styleHides(props.style)) return false;
    current = current.parent;
  }
  return true;
}

function styleHides(style: unknown): boolean {
  if (style == null) return false;
  const list = Array.isArray(style) ? style.flat(4) : [style];
  for (const entry of list) {
    if (entry == null || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    if (record['display'] === 'none') return true;
    if (record['opacity'] === 0) return true;
    if (record['width'] === 0 && record['height'] === 0) return true;
  }
  return false;
}

function readHostText(element: ReactTestInstance): string | null {
  const props = element.props as {
    value?: unknown;
    children?: unknown;
    accessibilityLabel?: unknown;
  };
  if (typeof props.value === 'string') return props.value;
  if (typeof props.value === 'number') return String(props.value);
  const fromChildren = collectText(props.children);
  if (fromChildren.length > 0) return fromChildren;
  if (typeof props.accessibilityLabel === 'string') {
    return props.accessibilityLabel;
  }
  return null;
}

function collectText(children: unknown): string {
  if (children == null || typeof children === 'boolean') return '';
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(collectText).join('');
  }
  return '';
}
