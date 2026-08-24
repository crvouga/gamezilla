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

type FocusState = {
  readonly actors: Map<string, ReactElement>;
  activeActorId: string | undefined;
  readonly syncHost: () => void;
  readonly options: MultiAppRntlSessionOptions;
};

function focusActor(actorId: string, state: FocusState): void {
  if (!state.actors.has(actorId)) {
    throw new Error(`MultiAppRntlSession: unknown actor '${actorId}'`);
  }
  if (state.activeActorId === actorId) return;
  if (state.activeActorId !== undefined) {
    const blurred = state.activeActorId;
    state.activeActorId = undefined;
    state.syncHost();
    state.options.onActorBlur?.(blurred);
  }
  state.options.onActorFocus?.(actorId);
  state.activeActorId = actorId;
  state.syncHost();
}

function createActorFacade(
  actorId: string,
  deps: {
    readonly focus: (id: string) => void;
    readonly requireResult: () => RenderResult;
    readonly queryActorShell: (
      scope: RenderResult,
      id: string
    ) => RntlWithinRoot | null;
    readonly unmountActor: (id: string) => void;
  }
): RenderedApp {
  return createRenderedAppFromQueryScope({
    query: (testId) => {
      const scope = deps.requireResult();
      const shell = deps.queryActorShell(scope, actorId);
      if (shell === null) return null;
      return within(shell).queryByTestId(testId);
    },
    activate: async () => {
      deps.focus(actorId);
    },
    unmount: () => {
      deps.unmountActor(actorId);
    },
    snapshotHtml: (options) => {
      const scope = deps.requireResult();
      const subtree = actorSubtreeJson(scope, actorId);
      if (subtree === null) return undefined;
      return serializeHostTreeHtml(subtree, {
        ...(options?.stylesheetHref !== undefined
          ? { stylesheetHref: options.stylesheetHref }
          : {}),
      });
    },
  });
}

export function createMultiAppRntlSession(
  options: MultiAppRntlSessionOptions = {}
): MultiAppRntlSession {
  const actors = new Map<string, ReactElement>();
  const facades = new Map<string, RenderedApp>();
  let result: RenderResult | undefined;

  const focusState: FocusState = {
    actors,
    activeActorId: undefined,
    syncHost: () => {
      const activeActorId = focusState.activeActorId;
      const host = createElement(
        MultiAppHost,
        activeActorId === undefined ? { actors } : { actors, activeActorId }
      );
      if (result === undefined) {
        result = render(host);
        return;
      }
      result.rerender(host);
    },
    options,
  };

  const focus = (actorId: string): void => {
    focusActor(actorId, focusState);
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

  const createActorFacadeFor = (actorId: string): RenderedApp =>
    createActorFacade(actorId, {
      focus,
      requireResult,
      queryActorShell,
      unmountActor: (id) => session.unmountActor(id),
    });

  const session: MultiAppRntlSession = {
    mountActor(actorId, element) {
      const existing = facades.get(actorId);
      actors.set(actorId, element);
      focus(actorId);
      if (existing !== undefined) return existing;
      const facade = createActorFacadeFor(actorId);
      facades.set(actorId, facade);
      return facade;
    },
    unmountActor(actorId) {
      if (!actors.delete(actorId)) return;
      facades.delete(actorId);
      if (focusState.activeActorId === actorId) {
        focusState.activeActorId = undefined;
      }
      if (actors.size === 0) {
        result?.unmount();
        result = undefined;
        return;
      }
      focusState.syncHost();
    },
    clearFocus() {
      if (focusState.activeActorId === undefined) return;
      focusState.activeActorId = undefined;
      focusState.syncHost();
    },
    dispose() {
      facades.clear();
      actors.clear();
      focusState.activeActorId = undefined;
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
