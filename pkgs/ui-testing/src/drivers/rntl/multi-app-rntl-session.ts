import {
  act,
  type RenderResult,
  render,
  within,
} from '@testing-library/react-native';
import { createElement, type ReactElement } from 'react';

import type { RenderedApp } from '../../bootstrap/render-adapter';
import { actorShellTestId, MultiAppHost } from './multi-app-rntl-host';
import { createRenderedAppFromQueryScope } from './renderer-rntl';
import {
  isBlankSnapshotHtml,
  serializeHostTreeHtml,
} from './serialize-host-tree-html';

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

/** {@link RenderedApp} from a multi-actor session — always has {@link RenderedApp.activate}. */
export type FocusedRenderedApp = RenderedApp & {
  activate(): void | Promise<void>;
};

export type SnapshotAllActorsOptions = {
  readonly stylesheetHref?: string;
};

export type MultiAppRntlSession = {
  /** Mount or remount an actor subtree; returns a scoped {@link FocusedRenderedApp}. */
  mountActor(actorId: string, element: ReactElement): FocusedRenderedApp;
  /** Remove one actor subtree without tearing down siblings. */
  unmountActor(actorId: string): void;
  /** Unmount the active actor from the RNTL tree without dropping registration. */
  clearFocus(): void;
  /**
   * Snapshot every registered actor. The active actor is captured in place;
   * parked actors reuse their last cached HTML so the active tree is not remounted.
   */
  snapshotAllActors(
    options?: SnapshotAllActorsOptions
  ): Promise<ReadonlyMap<string, string>>;
  /** Currently focused actor id, if any. */
  activeActorId(): string | undefined;
  /** Unmount the shared RNTL root and clear all actors. */
  dispose(): void;
};

type FocusState = {
  readonly actors: Map<string, ReactElement>;
  activeActorId: string | undefined;
  readonly syncHost: () => void;
  readonly options: MultiAppRntlSessionOptions;
  readonly cacheBlurredActor: (actorId: string) => void;
};

type FocusMode = 'activate' | 'snapshot';

function focusActorSync(
  actorId: string,
  state: FocusState,
  mode: FocusMode = 'activate'
): void {
  if (!state.actors.has(actorId)) {
    throw new Error(`MultiAppRntlSession: unknown actor '${actorId}'`);
  }
  if (state.activeActorId === actorId) return;
  if (state.activeActorId !== undefined) {
    const blurred = state.activeActorId;
    if (mode === 'activate') {
      state.cacheBlurredActor(blurred);
      state.options.onActorBlur?.(blurred);
    }
    state.activeActorId = undefined;
    state.syncHost();
  }
  if (mode === 'activate') {
    state.options.onActorFocus?.(actorId);
  }
  state.activeActorId = actorId;
  state.syncHost();
}

async function flushHost(
  syncHost: () => void,
  asyncFlush: boolean
): Promise<void> {
  if (asyncFlush) {
    await act(() => {
      syncHost();
    });
    return;
  }
  syncHost();
}

async function focusActor(
  actorId: string,
  state: FocusState,
  asyncFlush: boolean,
  mode: FocusMode = 'activate'
): Promise<void> {
  if (!state.actors.has(actorId)) {
    throw new Error(`MultiAppRntlSession: unknown actor '${actorId}'`);
  }
  if (state.activeActorId === actorId) return;
  if (state.activeActorId !== undefined) {
    const blurred = state.activeActorId;
    if (mode === 'activate') {
      state.cacheBlurredActor(blurred);
      state.options.onActorBlur?.(blurred);
    }
    state.activeActorId = undefined;
    await flushHost(state.syncHost, asyncFlush);
  }
  if (mode === 'activate') {
    state.options.onActorFocus?.(actorId);
  }
  state.activeActorId = actorId;
  await flushHost(state.syncHost, asyncFlush);
}

function createActorFacade(
  actorId: string,
  deps: {
    readonly focus: (id: string) => Promise<void>;
    readonly requireResult: () => RenderResult;
    readonly queryActorShell: (
      scope: RenderResult,
      id: string
    ) => RntlWithinRoot | null;
    readonly unmountActor: (id: string) => void;
  }
): FocusedRenderedApp {
  return createRenderedAppFromQueryScope({
    query: (testId) => {
      const scope = deps.requireResult();
      const shell = deps.queryActorShell(scope, actorId);
      if (shell === null) return null;
      return within(shell).queryByTestId(testId);
    },
    activate: async () => {
      await deps.focus(actorId);
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
  }) as FocusedRenderedApp;
}

export function createMultiAppRntlSession(
  options: MultiAppRntlSessionOptions = {}
): MultiAppRntlSession {
  const actors = new Map<string, ReactElement>();
  const facades = new Map<string, FocusedRenderedApp>();
  const snapshotCache = new Map<string, string>();
  let result: RenderResult | undefined;

  const focusState: FocusState = {
    actors,
    activeActorId: undefined,
    syncHost: () => {
      const activeActorId = focusState.activeActorId;
      const host = createElement(MultiAppHost, {
        actors,
        ...(activeActorId !== undefined ? { activeActorId } : {}),
      });
      if (result === undefined) {
        result = render(host);
        return;
      }
      result.rerender(host);
    },
    options,
    cacheBlurredActor: (actorId) => {
      cacheActorSnapshot(actorId, { facades, snapshotCache });
    },
  };

  const focus = (actorId: string): Promise<void> =>
    focusActor(actorId, focusState, true, 'activate');

  const focusForSnapshot = (actorId: string): Promise<void> =>
    focusActor(actorId, focusState, true, 'snapshot');

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

  return buildMultiAppSession({
    actors,
    facades,
    snapshotCache,
    focusState,
    focus,
    focusForSnapshot,
    requireResult,
    queryActorShell,
    getResult: () => result,
    setResult: (next) => {
      result = next;
    },
  });
}

function cacheActorSnapshot(
  actorId: string,
  deps: {
    readonly facades: Map<string, FocusedRenderedApp>;
    readonly snapshotCache: Map<string, string>;
    readonly options?: SnapshotAllActorsOptions;
  }
): void {
  const html = deps.facades.get(actorId)?.snapshotHtml?.(deps.options);
  // Never wipe a non-blank cache when the live tree is a blank shell.
  if (html !== undefined && !isBlankSnapshotHtml(html)) {
    deps.snapshotCache.set(actorId, html);
  }
}

function rememberSnapshotHtml(
  snapshotCache: Map<string, string>,
  actorId: string,
  html: string | undefined
): string | undefined {
  if (html !== undefined && !isBlankSnapshotHtml(html)) {
    snapshotCache.set(actorId, html);
    return html;
  }
  const cached = snapshotCache.get(actorId);
  if (cached !== undefined && !isBlankSnapshotHtml(cached)) return cached;
  return undefined;
}

function readCachedSnapshots(
  deps: {
    readonly facades: Map<string, FocusedRenderedApp>;
    readonly snapshotCache: Map<string, string>;
    readonly focusForSnapshot: (actorId: string) => Promise<void>;
  },
  options: SnapshotAllActorsOptions,
  prior: string | undefined,
  out: Map<string, string>
): Promise<void> {
  return (async () => {
    for (const actorId of deps.facades.keys()) {
      if (actorId === prior) continue;
      const cached = deps.snapshotCache.get(actorId);
      if (cached !== undefined && !isBlankSnapshotHtml(cached)) {
        out.set(actorId, cached);
        continue;
      }
      if (prior !== undefined) continue;
      await deps.focusForSnapshot(actorId);
      const html = deps.facades.get(actorId)?.snapshotHtml?.(options);
      const remembered = rememberSnapshotHtml(
        deps.snapshotCache,
        actorId,
        html
      );
      if (remembered !== undefined) {
        out.set(actorId, remembered);
      }
    }
  })();
}

function buildMultiAppSession(deps: {
  readonly actors: Map<string, ReactElement>;
  readonly facades: Map<string, FocusedRenderedApp>;
  readonly snapshotCache: Map<string, string>;
  readonly focusState: FocusState;
  readonly focus: (actorId: string) => Promise<void>;
  readonly focusForSnapshot: (actorId: string) => Promise<void>;
  readonly requireResult: () => RenderResult;
  readonly queryActorShell: (
    scope: RenderResult,
    actorId: string
  ) => RntlWithinRoot | null;
  readonly getResult: () => RenderResult | undefined;
  readonly setResult: (next: RenderResult | undefined) => void;
}): MultiAppRntlSession {
  const createActorFacadeFor = (actorId: string): FocusedRenderedApp =>
    createActorFacade(actorId, {
      focus: deps.focus,
      requireResult: deps.requireResult,
      queryActorShell: deps.queryActorShell,
      unmountActor: (id) => session.unmountActor(id),
    });

  const session: MultiAppRntlSession = {
    mountActor(actorId, element) {
      const existing = deps.facades.get(actorId);
      deps.actors.set(actorId, element);
      focusActorSync(actorId, deps.focusState);
      if (existing !== undefined) return existing;
      const facade = createActorFacadeFor(actorId);
      deps.facades.set(actorId, facade);
      return facade;
    },
    unmountActor(actorId) {
      if (!deps.actors.delete(actorId)) return;
      deps.facades.delete(actorId);
      deps.snapshotCache.delete(actorId);
      if (deps.focusState.activeActorId === actorId) {
        deps.focusState.activeActorId = undefined;
      }
      if (deps.actors.size === 0) {
        deps.getResult()?.unmount();
        deps.setResult(undefined);
        return;
      }
      deps.focusState.syncHost();
    },
    clearFocus() {
      const active = deps.focusState.activeActorId;
      if (active === undefined) return;
      deps.focusState.cacheBlurredActor(active);
      deps.focusState.activeActorId = undefined;
      deps.focusState.syncHost();
    },
    activeActorId() {
      return deps.focusState.activeActorId;
    },
    async snapshotAllActors(options = {}) {
      const prior = deps.focusState.activeActorId;
      const out = new Map<string, string>();

      if (prior !== undefined) {
        const activeHtml = deps.facades.get(prior)?.snapshotHtml?.(options);
        const remembered = rememberSnapshotHtml(
          deps.snapshotCache,
          prior,
          activeHtml
        );
        if (remembered !== undefined) {
          out.set(prior, remembered);
        }
      }

      await readCachedSnapshots(deps, options, prior, out);
      return out;
    },
    dispose() {
      deps.facades.clear();
      deps.actors.clear();
      deps.snapshotCache.clear();
      deps.focusState.activeActorId = undefined;
      deps.getResult()?.unmount();
      deps.setResult(undefined);
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
