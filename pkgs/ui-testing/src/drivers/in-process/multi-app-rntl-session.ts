import {
  type RenderResult,
  render,
  within,
} from '@testing-library/react-native';
import { createElement, type ReactElement } from 'react';

import type { RenderedApp } from '../../bootstrap/render-adapter';
import { actorShellTestId, MultiAppHost } from './multi-app-rntl-host';
import { createRenderedAppFromQueryScope } from './renderer-rntl';
import { serializeHostTreeHtml } from './serialize-host-tree-html';

type RntlWithinRoot = Parameters<typeof within>[0];

type JsonNode =
  | string
  | {
      readonly type: string | unknown;
      readonly props: Record<string, unknown>;
      readonly children: JsonNode[] | null;
    };

export type MultiAppRntlSessionOptions = {
  /** Called once before an actor is mounted as the active RNTL root. */
  readonly onActorFocus?: (actorId: string) => void;
  /** Called once after the previous actor is unmounted from the RNTL tree. */
  readonly onActorBlur?: (actorId: string) => void;
};

export type MultiAppRntlSession = {
  /** Mount or remount an actor subtree; returns a scoped {@link RenderedApp}. */
  mountActor(actorId: string, element: ReactElement): RenderedApp;
  /** Remove one actor subtree without tearing down siblings. */
  unmountActor(actorId: string): void;
  /** Unmount the active actor from the RNTL tree without dropping registration. */
  clearFocus(): void;
  /** Unmount the shared RNTL root and clear all actors. */
  dispose(): void;
};

export function createMultiAppRntlSession(
  options: MultiAppRntlSessionOptions = {}
): MultiAppRntlSession {
  const actors = new Map<string, ReactElement>();
  const facades = new Map<string, RenderedApp>();
  let result: RenderResult | undefined;
  let activeActorId: string | undefined;

  const syncHost = (): void => {
    const host = createElement(
      MultiAppHost,
      activeActorId === undefined ? { actors } : { actors, activeActorId }
    );
    if (result === undefined) {
      result = render(host);
      return;
    }
    result.rerender(host);
  };

  const requireResult = (): RenderResult => {
    if (result === undefined) {
      throw new Error('MultiAppRntlSession: no actors mounted');
    }
    return result;
  };

  const queryActorShell = (
    scope: RenderResult,
    actorId: string
  ): RntlWithinRoot | null => {
    return scope.queryByTestId(actorShellTestId(actorId));
  };

  const focusActor = (actorId: string): void => {
    if (!actors.has(actorId)) {
      throw new Error(`MultiAppRntlSession: unknown actor '${actorId}'`);
    }
    if (activeActorId === actorId) return;
    if (activeActorId !== undefined) {
      const blurred = activeActorId;
      activeActorId = undefined;
      syncHost();
      options.onActorBlur?.(blurred);
    }
    options.onActorFocus?.(actorId);
    activeActorId = actorId;
    syncHost();
  };

  const createActorFacade = (actorId: string): RenderedApp => {
    return createRenderedAppFromQueryScope({
      query: (testId) => {
        const scope = requireResult();
        const shell = queryActorShell(scope, actorId);
        if (shell === null) return null;
        return within(shell).queryByTestId(testId);
      },
      activate: async () => {
        focusActor(actorId);
      },
      unmount: () => {
        session.unmountActor(actorId);
      },
      snapshotHtml: (options) => {
        const scope = requireResult();
        const subtree = actorSubtreeJson(scope, actorId);
        if (subtree === null) return undefined;
        return serializeHostTreeHtml(subtree, {
          ...(options?.stylesheetHref !== undefined
            ? { stylesheetHref: options.stylesheetHref }
            : {}),
        });
      },
    });
  };

  const session: MultiAppRntlSession = {
    mountActor(actorId, element) {
      const existing = facades.get(actorId);
      actors.set(actorId, element);
      focusActor(actorId);
      if (existing !== undefined) {
        return existing;
      }
      const facade = createActorFacade(actorId);
      facades.set(actorId, facade);
      return facade;
    },
    unmountActor(actorId) {
      if (!actors.delete(actorId)) return;
      facades.delete(actorId);
      if (activeActorId === actorId) {
        activeActorId = undefined;
      }
      if (actors.size === 0) {
        result?.unmount();
        result = undefined;
        return;
      }
      syncHost();
    },
    clearFocus() {
      if (activeActorId === undefined) return;
      activeActorId = undefined;
      syncHost();
    },
    dispose() {
      facades.clear();
      actors.clear();
      activeActorId = undefined;
      result?.unmount();
      result = undefined;
    },
  };

  return session;
}

function actorSubtreeJson(
  scope: RenderResult,
  actorId: string
): JsonNode | null {
  const root = scope.toJSON() as JsonNode | null;
  if (root === null) return null;
  return findSubtreeByTestId(root, actorShellTestId(actorId));
}

function findSubtreeByTestId(node: JsonNode, testId: string): JsonNode | null {
  if (typeof node === 'string') return null;
  const props = node.props;
  if (props['testID'] === testId || props['data-testid'] === testId) {
    return node;
  }
  const children = node.children;
  if (children === null) return null;
  for (const child of children) {
    const match = findSubtreeByTestId(child, testId);
    if (match !== null) return match;
  }
  return null;
}
