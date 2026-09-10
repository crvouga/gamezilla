/** @jsxImportSource solid-js */
/**
 * Dismissible banner anchored to the top or bottom edge. Renders into
 * {@link DismissibleBannerPortalProvider}'s host via `solid-js/web` `Portal`
 * (mount the provider once at app root, inside the theme root).
 *
 * Enter is instant (matches RN: snap in); dismiss slides the banner off its
 * edge with a CSS transition (`Motion`) and then calls `onDismiss`. Timing
 * uses the injected `Timers`, so the exit is deterministic in tests.
 */

import { useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock/solid';
import {
  createContext,
  createEffect,
  createSignal,
  type JSX,
  on,
  onCleanup,
  Show,
  useContext,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import type { ComponentDataSet } from '../../component-id';
import { useThemeTokens } from '../../theme';
import { joinClass } from '../box/box';
import { Button } from '../button';
import { IconButton } from '../icon-button';
import { XIcon } from '../icons';
import { Motion } from '../motion';

export type DismissibleBannerPosition = 'top' | 'bottom';

/** Slide distance when the banner's own height is unknown. */
export const DISMISSIBLE_BANNER_SLIDE_PX = 120;

type PortalApi = {
  host: () => HTMLElement | null;
};

const DismissibleBannerPortalContext = createContext<PortalApi | null>(null);

export type DismissibleBannerPortalProviderProps = {
  children: JSX.Element;
};

export function DismissibleBannerPortalProvider(
  props: DismissibleBannerPortalProviderProps
): JSX.Element {
  const [host, setHost] = createSignal<HTMLElement | null>(null);
  return (
    <DismissibleBannerPortalContext.Provider value={{ host }}>
      <div class="box flex-1 relative">
        {props.children}
        <div
          class="box absolute inset-0 pointer-events-none"
          style={{ 'z-index': 999_999 }}
          data-component="DismissibleBannerPortalHost"
          ref={setHost}
        />
      </div>
    </DismissibleBannerPortalContext.Provider>
  );
}

const MISSING_PORTAL_MSG =
  'DismissibleBanner requires DismissibleBannerPortalProvider at the app root. Wrap your app inside the theme root with <DismissibleBannerPortalProvider>…</DismissibleBannerPortalProvider>.';

export type DismissibleBannerProps = {
  visible: boolean;
  /** Called after the dismiss control's exit animation finishes. */
  onDismiss: () => void;
  /** Primary prompt line. */
  title: JSX.Element;
  /** Optional secondary line under the title. */
  subtitle?: JSX.Element | undefined;
  /** Label for a single optional action control (requires {@link onActionClick}). */
  actionLabel?: JSX.Element | undefined;
  /** Handler for {@link actionLabel}. */
  onActionClick?: (() => void) | undefined;
  /** Edge the banner attaches to; also controls slide direction and safe-area padding. */
  position?: DismissibleBannerPosition | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function DismissibleBannerPromptBody(props: {
  title: JSX.Element;
  subtitle: JSX.Element | undefined;
  actionLabel: JSX.Element | undefined;
  onActionClick: (() => void) | undefined;
}): JSX.Element {
  return (
    <div class="box flex-1 min-w-[0] flex-row items-center gap-3 flex-wrap">
      <div class="box flex-1 min-w-[120px] gap-1">
        <p class="text textBodyBold">{props.title}</p>
        <Show when={props.subtitle !== undefined && props.subtitle !== null}>
          <p class="text textCaption">{props.subtitle}</p>
        </Show>
      </div>
      <Show
        when={
          props.actionLabel !== undefined &&
          props.actionLabel !== null &&
          props.onActionClick !== undefined
        }
      >
        <Button
          title={props.actionLabel}
          onClick={() => props.onActionClick?.()}
        />
      </Show>
    </div>
  );
}

function edgeClass(position: DismissibleBannerPosition): string {
  return position === 'top'
    ? 'pb-3 border-b border-solid border-border'
    : 'pt-3 border-t border-solid border-border';
}

function edgeStyle(position: DismissibleBannerPosition): JSX.CSSProperties {
  return position === 'top'
    ? { 'padding-top': 'calc(env(safe-area-inset-top, 0px) + 12px)' }
    : { 'padding-bottom': 'calc(env(safe-area-inset-bottom, 0px) + 12px)' };
}

function DismissibleBannerFrame(
  props: DismissibleBannerProps & {
    position: DismissibleBannerPosition;
    dismiss: () => void;
  }
): JSX.Element {
  const { t } = useLingui();
  return (
    <div
      class={joinClass(
        'box px-4 bg-surface flex-row items-center gap-3 pointer-events-auto',
        edgeClass(props.position)
      )}
      style={edgeStyle(props.position)}
    >
      <DismissibleBannerPromptBody
        title={props.title}
        subtitle={props.subtitle}
        actionLabel={props.actionLabel}
        onActionClick={props.onActionClick}
      />
      <IconButton
        size={40}
        onClick={props.dismiss}
        label={t`Dismiss`}
        aria-label={t`Dismiss`}
        tooltip="none"
        dataSet={{ component: 'DismissibleBannerDismiss' }}
      >
        <XIcon size={20} color="icon" />
      </IconButton>
    </div>
  );
}

/**
 * Presence machine: `visible` shows instantly; dismissing (or `visible`
 * flipping false) plays the slide-out, then `onDismiss` fires once the exit
 * duration elapses on the injected timers.
 */
function useBannerPresence(
  props: DismissibleBannerProps,
  exitMs: () => number
): { present: () => boolean; dismiss: () => void } {
  const timers = useTimers();
  const [dismissing, setDismissing] = createSignal(false);
  let handle: unknown;
  const clear = (): void => {
    if (handle !== undefined) timers.clearTimeout(handle);
    handle = undefined;
  };
  onCleanup(clear);
  createEffect(
    on(
      () => props.visible,
      (visible) => {
        if (visible) {
          clear();
          setDismissing(false);
        }
      },
      { defer: true }
    )
  );
  const dismiss = (): void => {
    if (dismissing()) return;
    setDismissing(true);
    clear();
    handle = timers.setTimeout(() => {
      handle = undefined;
      props.onDismiss();
    }, exitMs());
  };
  return { present: () => props.visible && !dismissing(), dismiss };
}

export function DismissibleBanner(props: DismissibleBannerProps): JSX.Element {
  const portal = useContext(DismissibleBannerPortalContext);
  const tokens = useThemeTokens();
  const position = (): DismissibleBannerPosition => props.position ?? 'top';
  const sign = (): number => (position() === 'top' ? -1 : 1);
  const presence = useBannerPresence(props, () => tokens.motion.duration.fast);

  // A visible banner without a host is a wiring bug; a hidden one is inert.
  createEffect(() => {
    if (portal === null && props.visible) throw new Error(MISSING_PORTAL_MSG);
  });

  const offscreen = (): JSX.CSSProperties => ({
    transform: `translateY(${sign() * DISMISSIBLE_BANNER_SLIDE_PX}px)`,
    opacity: 0,
  });

  return (
    <Show when={portal?.host()}>
      {(host) => (
        <Portal mount={host()}>
          <Motion
            class="absolute z-[9999] left-0 right-0"
            style={position() === 'top' ? { top: 0 } : { bottom: 0 }}
            present={presence.present()}
            duration="fast"
            easing="accelerate"
            property="transform, opacity"
            enterStyle={{ opacity: 1, transform: 'translateY(0)' }}
            exitStyle={offscreen()}
            role="status"
            dataSet={{
              component: 'DismissibleBanner',
              position: position(),
              ...props.dataSet,
            }}
          >
            <DismissibleBannerFrame
              {...props}
              position={position()}
              dismiss={presence.dismiss}
            />
          </Motion>
        </Portal>
      )}
    </Show>
  );
}
