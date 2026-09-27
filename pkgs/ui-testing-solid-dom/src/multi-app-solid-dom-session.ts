/**
 * Multi-actor session over one shared `document.body`. Each actor is a Solid
 * component rendered into its own `div[data-actor]`. Every actor's root stays
 * alive — people use their apps at the same time, so a parked actor keeps its
 * room connections, subscriptions and screen state — but only the focused
 * actor's container is attached under the session host, so queries, taps and
 * layout see one phone at a time. Parked actors keep their last non-blank
 * snapshot HTML for reports.
 */

import type { JSX } from 'solid-js';
import type { LayoutProvider } from './dom-layout';
import { mountSolidRoot, type SolidMount } from './mount-solid-app';
import {
  createDomUser,
  createSolidDomRenderedApp,
  type SolidDomRenderedApp,
  type UserEvent,
} from './renderer-solid-dom';
import {
  isBlankSnapshotHtml,
  type SerializeDomHtmlOptions,
} from './serialize-dom-html';

export const MULTI_APP_HOST_COMPONENT = 'MultiAppHost';

export type MultiAppSolidDomSessionOptions = {
  /** DOM document hosting the actors; defaults to the global `document`. */
  readonly document?: Document | undefined;
  /** Called once before an actor is mounted as the active tree. */
  readonly onActorFocus?: ((actorId: string) => void) | undefined;
  /** Called once after the previous actor is detached from the DOM. */
  readonly onActorBlur?: ((actorId: string) => void) | undefined;
  /** Layout synthesis for coordinate gestures on unmeasured hosts. */
  readonly layoutProvider?: LayoutProvider | undefined;
};

/** {@link SolidDomRenderedApp} from a multi-actor session — always focusable. */
export type FocusedRenderedApp = SolidDomRenderedApp;

export type SnapshotAllActorsOptions = SerializeDomHtmlOptions;

export type MultiAppSolidDomSession = {
  /** Mount or remount an actor; returns a scoped {@link FocusedRenderedApp}. */
  mountActor(actorId: string, component: () => JSX.Element): FocusedRenderedApp;
  /** Remove one actor without tearing down siblings. */
  unmountActor(actorId: string): void;
  /** Detach the active actor from the DOM; its app keeps running. */
  clearFocus(): void;
  /**
   * Snapshot every registered actor. The active actor is captured in place;
   * parked actors reuse their last cached HTML so the active tree stays put.
   */
  snapshotAllActors(
    options?: SnapshotAllActorsOptions
  ): Promise<ReadonlyMap<string, string>>;
  /** Currently focused actor id, if any. */
  activeActorId(): string | undefined;
  /** Unmount everything and clear all actors. */
  dispose(): void;
};

type ActorRecord = {
  component: () => JSX.Element;
  readonly facade: FocusedRenderedApp;
};

type FocusMode = 'activate' | 'snapshot';

class SessionCore {
  readonly actors = new Map<string, ActorRecord>();
  readonly snapshotCache = new Map<string, string>();
  /** Live Solid roots, attached or parked. */
  private readonly mounts = new Map<string, SolidMount>();
  readonly document: Document;
  readonly user: UserEvent;
  private host: HTMLElement | null = null;
  private active: string | undefined;

  constructor(readonly options: MultiAppSolidDomSessionOptions) {
    this.document = options.document ?? document;
    this.user = createDomUser(this.document);
  }

  activeId(): string | undefined {
    return this.active;
  }

  containerOf(actorId: string): HTMLElement | null {
    return this.active === actorId
      ? (this.mounts.get(actorId)?.container ?? null)
      : null;
  }

  requireActor(actorId: string): ActorRecord {
    const record = this.actors.get(actorId);
    if (record === undefined) {
      throw new Error(`MultiAppSolidDomSession: unknown actor '${actorId}'`);
    }
    return record;
  }

  focus(actorId: string, mode: FocusMode): void {
    const record = this.requireActor(actorId);
    if (this.active === actorId) return;
    if (this.active !== undefined) {
      const blurred = this.active;
      if (mode === 'activate') {
        this.cacheSnapshot(blurred);
        this.options.onActorBlur?.(blurred);
      }
      this.detachActive();
    }
    if (mode === 'activate') this.options.onActorFocus?.(actorId);
    this.attach(actorId, record);
  }

  /** A new component for a live actor: dispose its root and render afresh. */
  remount(actorId: string, record: ActorRecord): void {
    const onScreen = this.active === actorId;
    this.disposeActor(actorId);
    if (onScreen) this.attach(actorId, record);
  }

  /** Take the active actor off screen; its root keeps running. */
  detachActive(): void {
    if (this.active === undefined) return;
    this.mounts.get(this.active)?.container.remove();
    this.active = undefined;
  }

  disposeActor(actorId: string): void {
    this.mounts.get(actorId)?.dispose();
    this.mounts.delete(actorId);
    if (this.active === actorId) this.active = undefined;
  }

  disposeAll(): void {
    for (const actorId of [...this.mounts.keys()]) this.disposeActor(actorId);
  }

  /** Cache the active actor's HTML unless the live tree is a blank shell. */
  cacheSnapshot(actorId: string, options?: SnapshotAllActorsOptions): void {
    const html = this.actors.get(actorId)?.facade.snapshotHtml(options);
    if (html !== undefined && !isBlankSnapshotHtml(html)) {
      this.snapshotCache.set(actorId, html);
    }
  }

  /** Fresh non-blank HTML wins; else the cached copy; else nothing. */
  rememberSnapshot(
    actorId: string,
    options: SnapshotAllActorsOptions
  ): string | undefined {
    this.cacheSnapshot(actorId, options);
    return this.snapshotCache.get(actorId);
  }

  removeHostIfEmpty(): void {
    if (this.actors.size > 0 || this.host === null) return;
    this.host.remove();
    this.host = null;
  }

  private ensureHost(): HTMLElement {
    if (this.host !== null) return this.host;
    const host = this.document.createElement('div');
    host.setAttribute('data-component', MULTI_APP_HOST_COMPONENT);
    this.document.body.appendChild(host);
    this.host = host;
    return host;
  }

  /** Put the actor on screen: reattach its live root, or render it the first time. */
  private attach(actorId: string, record: ActorRecord): void {
    const host = this.ensureHost();
    const parked = this.mounts.get(actorId);
    if (parked === undefined) {
      this.mounts.set(
        actorId,
        mountSolidRoot(record.component, this.document, host, actorId)
      );
    } else {
      host.appendChild(parked.container);
    }
    this.active = actorId;
  }
}

function createActorFacade(
  core: SessionCore,
  actorId: string,
  unmount: () => void
): FocusedRenderedApp {
  return createSolidDomRenderedApp({
    document: core.document,
    container: () => core.containerOf(actorId),
    activate: () => core.focus(actorId, 'activate'),
    layoutProvider: core.options.layoutProvider,
    user: core.user,
    unmount,
  });
}

function snapshotAll(
  core: SessionCore,
  options: SnapshotAllActorsOptions
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const prior = core.activeId();
  if (prior !== undefined) {
    const html = core.rememberSnapshot(prior, options);
    if (html !== undefined) out.set(prior, html);
  }
  for (const actorId of core.actors.keys()) {
    if (actorId === prior) continue;
    const cached = core.snapshotCache.get(actorId);
    if (cached !== undefined) {
      out.set(actorId, cached);
      continue;
    }
    if (prior !== undefined) continue;
    core.focus(actorId, 'snapshot');
    const html = core.rememberSnapshot(actorId, options);
    if (html !== undefined) out.set(actorId, html);
  }
  return out;
}

export function createMultiAppSolidDomSession(
  options: MultiAppSolidDomSessionOptions = {}
): MultiAppSolidDomSession {
  const core = new SessionCore(options);
  const session: MultiAppSolidDomSession = {
    mountActor(actorId, component) {
      const existing = core.actors.get(actorId);
      if (existing !== undefined) {
        existing.component = component;
        core.remount(actorId, existing);
        core.focus(actorId, 'activate');
        return existing.facade;
      }
      const record: ActorRecord = {
        component,
        facade: createActorFacade(core, actorId, () =>
          session.unmountActor(actorId)
        ),
      };
      core.actors.set(actorId, record);
      core.focus(actorId, 'activate');
      return record.facade;
    },
    unmountActor(actorId) {
      if (!core.actors.delete(actorId)) return;
      core.snapshotCache.delete(actorId);
      core.disposeActor(actorId);
      core.removeHostIfEmpty();
    },
    clearFocus() {
      const active = core.activeId();
      if (active === undefined) return;
      core.cacheSnapshot(active);
      core.detachActive();
    },
    snapshotAllActors: (snapshotOptions = {}) =>
      Promise.resolve(snapshotAll(core, snapshotOptions)),
    activeActorId: () => core.activeId(),
    dispose() {
      core.disposeAll();
      core.actors.clear();
      core.snapshotCache.clear();
      core.removeHostIfEmpty();
    },
  };
  return session;
}
