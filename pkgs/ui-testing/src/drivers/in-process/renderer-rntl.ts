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

export type CreateRenderedAppFromQueryScopeOptions =
  CreateRenderedAppFromRntlOptions & {
    readonly query: (testId: string) => HostNode | null;
    readonly unmount: () => void | Promise<void>;
    readonly snapshotHtml?: (options?: {
      readonly stylesheetHref?: string;
    }) => string | undefined;
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
  return createRenderedAppFromQueryScope({
    ...options,
    query: (testId) => queryNode(result, testId),
    unmount: () => result.unmount(),
    snapshotHtml: (snapshotOptions) =>
      serializeHostTreeHtml(result.toJSON(), {
        ...(snapshotOptions?.stylesheetHref !== undefined
          ? { stylesheetHref: snapshotOptions.stylesheetHref }
          : {}),
      }),
  });
}

export function createRenderedAppFromQueryScope(
  options: CreateRenderedAppFromQueryScopeOptions
): RenderedApp {
  const user = options.user ?? userEvent.setup({ delay: 0 });
  const app: RenderedApp = {
    query: options.query,
    isVisible: (element) => {
      try {
        return isHostVisible(asInstance(element));
      } catch {
        // RN Animated / style proxies can throw during opacity reads (e.g.
        // `flatten` on an unset node). Treat as not visible and keep polling.
        return false;
      }
    },
    getText: (element) => readHostText(asInstance(element)),
    tap: async (element) => {
      // `act` flushes pending useSyncExternalStore updates (e.g. client_config
      // SQL watch) before/with the press — otherwise SignInCapabilities can
      // stay stale and the modal opens with “no methods configured”.
      await act(async () => {
        fireEvent.press(asInstance(element));
      });
    },
    tapAt: async (element) => {
      await act(async () => {
        fireEvent.press(asInstance(element));
      });
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
    unmount: options.unmount,
    snapshotHtml: options.snapshotHtml,
    /**
     * Flush pending React updates (AuthBridge / sync / stores). Required
     * between wait polls — without this, async setState stays invisible
     * to queries until some other `act` (historically `router.push`).
     */
    activate: async () => {
      if (options.activate !== undefined) {
        await options.activate();
      }
      await act(async () => {
        await Promise.resolve();
      });
    },
  };
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

function queryNode(scope: RenderResult, testId: string): HostNode | null {
  return scope.queryByTestId(testId);
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
    if (
      props.pointerEvents === 'none' ||
      stylePointerEvents(props.style) === 'none'
    ) {
      return false;
    }
    if (styleHides(props.style)) return false;
    current = current.parent;
  }
  return true;
}

function styleHides(style: unknown): boolean {
  if (style == null) return false;
  const list = flattenStyleList(style);
  for (const entry of list) {
    if (entry == null || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    if (record['display'] === 'none') return true;
    if (styleOpacity(record['opacity']) === 0) return true;
    if (record['width'] === 0 && record['height'] === 0) return true;
  }
  return false;
}

function stylePointerEvents(style: unknown): string | undefined {
  if (style == null) return undefined;
  const list = flattenStyleList(style);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const entry = list[i];
    if (entry == null || typeof entry !== 'object') continue;
    const pe = (entry as Record<string, unknown>)['pointerEvents'];
    if (typeof pe === 'string') return pe;
  }
  return undefined;
}

/** Flatten RN style arrays without assuming `Array.prototype.flat` on proxies. */
function flattenStyleList(style: unknown): unknown[] {
  if (!Array.isArray(style)) return [style];
  const out: unknown[] = [];
  const stack: unknown[] = [...style];
  while (stack.length > 0) {
    const next = stack.pop();
    if (Array.isArray(next)) {
      for (let i = next.length - 1; i >= 0; i -= 1) {
        stack.push(next[i]);
      }
      continue;
    }
    out.push(next);
  }
  return out;
}

/** Resolve RN `Animated` nodes so opacity:0 is detected during fades. */
function styleOpacity(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (value == null || typeof value !== 'object') return undefined;
  if (!('__getValue' in value)) return undefined;
  try {
    const raw = (value as { __getValue?: () => unknown }).__getValue?.();
    return typeof raw === 'number' ? raw : undefined;
  } catch {
    return undefined;
  }
}

function readHostText(element: ReactTestInstance): string | null {
  const props = element.props as {
    value?: unknown;
    accessibilityLabel?: unknown;
  };
  if (typeof props.value === 'string') return props.value;
  if (typeof props.value === 'number') return String(props.value);
  const fromTree = collectInstanceText(element);
  if (fromTree.length > 0) return fromTree;
  if (typeof props.accessibilityLabel === 'string') {
    return props.accessibilityLabel;
  }
  return null;
}

/**
 * Skip subtrees that are not user-visible. Matches {@link isHostVisible}
 * signals so width-lock / aria-hidden spacers (e.g. Button feedback) do not
 * concatenate idle labels into `getText` (`Save` + `Saved` → `SaveSaved`).
 */
function nodeOmitsFromTextRead(instance: ReactTestInstance): boolean {
  const props = instance.props as {
    style?: unknown;
    accessibilityElementsHidden?: boolean;
    importantForAccessibility?: string;
  };
  if (props.accessibilityElementsHidden === true) return true;
  if (props.importantForAccessibility === 'no-hide-descendants') return true;
  if (styleHides(props.style)) return true;
  return false;
}

/** Walk the RNTL host tree (nested Text nodes under Pressable, etc.). */
function collectInstanceText(element: ReactTestInstance): string {
  let out = '';
  for (const child of element.children) {
    if (typeof child === 'string') {
      out += child;
      continue;
    }
    const instance = child as ReactTestInstance;
    if (nodeOmitsFromTextRead(instance)) continue;
    out += collectInstanceText(instance);
  }
  return out;
}
