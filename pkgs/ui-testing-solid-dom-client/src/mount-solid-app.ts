import type { RenderedApp } from '@pkgs/ui-testing-shared/render-adapter';
import type { JSX } from 'solid-js';
import { render } from 'solid-js/web';
import type { LayoutProvider } from './dom-layout';
import { ACTOR_ATTR } from './dom-query';
import { createSolidDomRenderedApp } from './renderer-solid-dom';
import type { UserEvent } from './renderer-solid-dom';
import { MULTI_APP_ACTOR_FRAME } from '@pkgs/ui-testing-solid-dom-shared/snapshot-frame';

export type MountSolidAppOptions = {
  readonly document: Document;
  /** Parent for the actor container; defaults to `document.body`. */
  readonly parent?: HTMLElement | undefined;
  /** `data-actor` value on the container; defaults to `"app"`. */
  readonly actorId?: string | undefined;
  readonly layoutProvider?: LayoutProvider | undefined;
  readonly user?: UserEvent | undefined;
  readonly activate?: (() => void | Promise<void>) | undefined;
  /** Called after the Solid root is disposed and the container removed. */
  readonly onUnmount?: (() => void) | undefined;
};

/** Actor container sized to the phone frame so inline layout math has a box. */
export function createActorContainer(
  document: Document,
  actorId: string
): HTMLElement {
  const container = document.createElement('div');
  container.setAttribute(ACTOR_ATTR, actorId);
  container.setAttribute('data-component', 'SolidDomActor');
  container.style.width = `${MULTI_APP_ACTOR_FRAME.width}px`;
  container.style.height = `${MULTI_APP_ACTOR_FRAME.height}px`;
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  // Flex column so the app root stretches to the frame in HTML snapshots.
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  return container;
}

export type SolidMount = {
  readonly container: HTMLElement;
  readonly dispose: () => void;
};

/** Render `component` into a fresh actor container under `parent`. */
export function mountSolidRoot(
  component: () => JSX.Element,
  document: Document,
  parent: HTMLElement,
  actorId: string
): SolidMount {
  const container = createActorContainer(document, actorId);
  parent.appendChild(container);
  const disposeRoot = render(component, container);
  return {
    container,
    dispose: () => {
      disposeRoot();
      container.remove();
    },
  };
}

/**
 * Mount a Solid component as a standalone {@link RenderedApp}: one container
 * appended to `document.body`, disposed on `unmount`.
 */
export function mountSolidApp(
  component: () => JSX.Element,
  options: MountSolidAppOptions
): RenderedApp {
  const parent = options.parent ?? options.document.body;
  let mount: SolidMount | null = mountSolidRoot(
    component,
    options.document,
    parent,
    options.actorId ?? 'app'
  );
  return createSolidDomRenderedApp({
    document: options.document,
    container: () => mount?.container ?? null,
    activate: options.activate,
    layoutProvider: options.layoutProvider,
    user: options.user,
    unmount: () => {
      mount?.dispose();
      mount = null;
      options.onUnmount?.();
    },
  });
}
