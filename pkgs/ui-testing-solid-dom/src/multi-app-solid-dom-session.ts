/**
 * Multi-actor session over one shared `document.body`. Each actor is a Solid
 * component; only the focused actor's tree is mounted (in its own
 * `div[data-actor]` under the session host). Parked actors dispose their
 * Solid root but keep their last non-blank snapshot HTML for reports.
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
  /** Called once after the previous actor is unmounted from the DOM. */
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
  /** Unmount the active actor from the DOM without dropping registration. */
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

type ActiveMount = { readonly id: string; readonly mount: SolidMount };

type FocusMode = 'activate' | 'snapshot';

class SessionCore {
  readonly actors = new Map<string, ActorRecord>();
  readonly snapshotCache = new Map<string, string>();
  readonly document: Document;
  readonly user: UserEvent;
  private host: HTMLElement | null = null;
  private active: ActiveMount | undefined;

  constructor(readonly options: MultiAppSolidDomSessionOptions) {
    this.document = options.document ?? document;
    this.user = createDomUser(this.document);
  }

  activeId(): string | undefined {
    return this.active?.id;
  }

  containerOf(actorId: string): HTMLElement | null {
    return this.active?.id === actorId ? this.active.mount.container : null;
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
    if (this.active?.id === actorId) return;
    if (this.active !== undefined) {
      const blurred = this.active.id;
      if (mode === 'activate') {
        this.cacheSnapshot(blurred);
        this.options.onActorBlur?.(blurred);
      }
      this.unmountActive();
    }
    if (mode === 'activate') this.options.onActorFocus?.(actorId);
    this.mountActive(actorId, record);
  }

  remountActive(actorId: string, record: ActorRecord): void {
    this.unmountActive();
    this.mountActive(actorId, record);
  }

  unmountActive(): void {
    this.active?.mount.dispose();
    this.active = undefined;
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

  private mountActive(actorId: string, record: ActorRecord): void {
    const mount = mountSolidRoot(
      record.component,
      this.document,
      this.ensureHost(),
      actorId
    );
    this.active = { id: actorId, mount };
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
        if (core.activeId() === actorId) core.remountActive(actorId, existing);
        else core.focus(actorId, 'activate');
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
      if (core.activeId() === actorId) core.unmountActive();
      core.removeHostIfEmpty();
    },
    clearFocus() {
      const active = core.activeId();
      if (active === undefined) return;
      core.cacheSnapshot(active);
      core.unmountActive();
    },
    snapshotAllActors: (snapshotOptions = {}) =>
      Promise.resolve(snapshotAll(core, snapshotOptions)),
    activeActorId: () => core.activeId(),
    dispose() {
      core.unmountActive();
      core.actors.clear();
      core.snapshotCache.clear();
      core.removeHostIfEmpty();
    },
  };
  return session;
}
