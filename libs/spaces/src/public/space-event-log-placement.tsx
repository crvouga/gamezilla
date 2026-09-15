/**
 * Wide active-space body may host an optional side rail for game chrome.
 * Games inject extras into the rail via {@link SpaceSideRailExtras}.
 *
 * Extras are portaled into a host node. Storing JSX in a signal and rendering
 * `{extras()}` re-enters the publisher (Maximum call stack).
 */

import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  useContext,
} from 'solid-js';
import { Portal } from 'solid-js/web';

type SpaceSideRailValue = {
  readonly host: Accessor<HTMLElement | undefined>;
  readonly setHost: (el: HTMLElement | undefined) => void;
  readonly hasExtras: Accessor<boolean>;
  readonly setHasExtras: (value: boolean) => void;
};

const SpaceSideRailContext = createContext<SpaceSideRailValue | null>(null);

const NO_EXTRAS: Accessor<boolean> = () => false;

const noopSetHost: (el: HTMLElement | undefined) => void = () => {};

export type SpaceSideRailProviderProps = {
  readonly children: JSX.Element;
};

export function SpaceSideRailProvider(
  props: SpaceSideRailProviderProps
): JSX.Element {
  const [host, setHost] = createSignal<HTMLElement | undefined>();
  const [hasExtras, setHasExtras] = createSignal(false);
  const value: SpaceSideRailValue = {
    host,
    setHost,
    hasExtras,
    setHasExtras,
  };
  return (
    <SpaceSideRailContext.Provider value={value}>
      {props.children}
    </SpaceSideRailContext.Provider>
  );
}

export function useSpaceSideRailHasExtras(): Accessor<boolean> {
  return useContext(SpaceSideRailContext)?.hasExtras ?? NO_EXTRAS;
}

export function useSetSpaceSideRailHost(): (
  el: HTMLElement | undefined
) => void {
  return useContext(SpaceSideRailContext)?.setHost ?? noopSetHost;
}

function stretchPortalMount(el: HTMLElement | undefined): void {
  if (el === undefined) return;
  const apply = (): void => {
    const parent = el.parentElement;
    if (parent === null) return;
    parent.classList.add(
      'box',
      'flex-1',
      'min-h-[0]',
      'min-w-[0]',
      'self-stretch'
    );
  };
  apply();
  queueMicrotask(apply);
}

/**
 * Publish nodes into the wide side rail. Cleared on unmount. No-op outside
 * {@link SpaceSideRailProvider} / compact layouts.
 */
export function SpaceSideRailExtras(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const ctx = useContext(SpaceSideRailContext);

  createEffect(() => {
    if (ctx === null) return;
    ctx.setHasExtras(true);
    onCleanup(() => ctx.setHasExtras(false));
  });

  return (
    <Show when={ctx?.host()}>
      {(host) => (
        <Portal mount={host()}>
          <div
            class="box flex-1 min-h-[0] min-w-[0] self-stretch"
            ref={stretchPortalMount}
          >
            {props.children}
          </div>
        </Portal>
      )}
    </Show>
  );
}
