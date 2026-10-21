/** @jsxImportSource solid-js */
/**
 * In-flow top/bottom banners. Mount {@link DismissibleBannerPortalProvider}
 * once at the app root (inside the theme root); banners portal into its host
 * slots and push app content rather than covering it.
 *
 * Prefer hosting the portal on {@link AppFrame} so wide-mode hosts sit outside
 * the max-width column (full-bleed sheet) while banner content still aligns to
 * {@link APP_MAX_WIDTH}. Use {@link InFlowBanner} for custom chrome (e.g. perf
 * HUD) and {@link DismissibleBanner} for the standard dismissible sheet. Mount
 * and dismiss are instant (no slide animation) for low-end Android.
 */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { cssPx } from '@pkgs/ui-root-shared/css-px';
import {
  APP_FRAME_GUTTER_STEP,
  APP_MAX_WIDTH,
} from '@pkgs/ui-root-shared/layout';
import { spacingScale } from '@pkgs/ui-root-shared/scale';
import {
  createContext,
  createEffect,
  createSignal,
  type JSX,
  Show,
  useContext,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { Button } from './button';
import { CONTENT_EDGE_PADDING_STEP } from './content-edge-padding';
import { IconButton } from './icon-button';
import { XIcon } from './icons';
import { useLayoutMode } from './use-layout-mode';

export type DismissibleBannerPosition = 'top' | 'bottom';

/** Surface tint for the banner sheet. */
export type DismissibleBannerTone = 'paper' | 'warning' | 'info';

type PortalApi = {
  host: (position: DismissibleBannerPosition) => HTMLElement | null;
};

const DismissibleBannerPortalContext = createContext<PortalApi | null>(null);

export type DismissibleBannerPortalProviderProps = {
  children: JSX.Element;
};

export function DismissibleBannerPortalProvider(
  props: DismissibleBannerPortalProviderProps
): JSX.Element {
  const [topHost, setTopHost] = createSignal<HTMLElement | null>(null);
  const [bottomHost, setBottomHost] = createSignal<HTMLElement | null>(null);
  const api: PortalApi = {
    host: (position) => (position === 'top' ? topHost() : bottomHost()),
  };
  return (
    <DismissibleBannerPortalContext.Provider value={api}>
      <div
        class="box flex-1 min-h-0 min-w-0"
        data-component="DismissibleBannerPortalRoot"
      >
        <div
          class="box shrink-0 w-full"
          data-component="DismissibleBannerPortalHost"
          data-position="top"
          ref={setTopHost}
        />
        <div class="box flex-1 min-h-0 min-w-0 relative">{props.children}</div>
        <div
          class="box shrink-0 w-full"
          data-component="DismissibleBannerPortalHost"
          data-position="bottom"
          ref={setBottomHost}
        />
      </div>
    </DismissibleBannerPortalContext.Provider>
  );
}

const MISSING_PORTAL_MSG =
  'In-flow banners require DismissibleBannerPortalProvider at the app root. Wrap your app inside the theme root with <DismissibleBannerPortalProvider>…</DismissibleBannerPortalProvider>.';

export type InFlowBannerProps = {
  children: JSX.Element;
  /** Edge host to mount into. Default `top`. */
  position?: DismissibleBannerPosition | undefined;
  /** When false, nothing is rendered (missing portal is ignored). Default true. */
  visible?: boolean | undefined;
};

/** Portal arbitrary chrome into an in-flow banner host (pushes app content). */
export function InFlowBanner(props: InFlowBannerProps): JSX.Element {
  const portal = useContext(DismissibleBannerPortalContext);
  const position = (): DismissibleBannerPosition => props.position ?? 'top';
  const visible = (): boolean => props.visible ?? true;

  createEffect(() => {
    if (portal === null && visible()) throw new Error(MISSING_PORTAL_MSG);
  });

  return (
    <Show when={portal?.host(position())}>
      {(host) => (
        <Portal mount={host()}>
          <Show when={visible()}>
            <div class="box w-full overflow-hidden shrink-0">
              {props.children}
            </div>
          </Show>
        </Portal>
      )}
    </Show>
  );
}

export type DismissibleBannerProps = {
  visible: boolean;
  /** Called when the dismiss control is pressed (instant). */
  onDismiss: () => void;
  /** Primary prompt line. */
  title: JSX.Element;
  /** Optional secondary line under the title. */
  subtitle?: JSX.Element | undefined;
  /** Label for a single optional action control (requires {@link onActionClick}). */
  actionLabel?: JSX.Element | undefined;
  /** Handler for {@link actionLabel}. */
  onActionClick?: (() => void) | undefined;
  /** DOM `data-*` identifiers for the action control. */
  actionDataSet?: ComponentDataSet | undefined;
  /** Edge the banner attaches to; also controls safe-area padding. */
  position?: DismissibleBannerPosition | undefined;
  /** Sheet background. Defaults to elevated paper (`surface-overlay`). */
  tone?: DismissibleBannerTone | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function DismissibleBannerPromptBody(props: {
  title: JSX.Element;
  subtitle: JSX.Element | undefined;
  actionLabel: JSX.Element | undefined;
  onActionClick: (() => void) | undefined;
  actionDataSet: ComponentDataSet | undefined;
}): JSX.Element {
  return (
    <div class="box flex-1 min-w-0 flex-row items-center gap-2 flex-wrap">
      <div class="box flex-1 min-w-0 gap-0.5">
        <p class="text textLabel">{props.title}</p>
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
          size="sm"
          title={props.actionLabel}
          onClick={() => props.onActionClick?.()}
          dataSet={props.actionDataSet}
        />
      </Show>
    </div>
  );
}

const TONE_BG: Record<DismissibleBannerTone, string> = {
  paper: 'bg-surface-overlay',
  warning: 'bg-warning-surface',
  info: 'bg-info-surface',
};

const EDGE_SAFE_PAD_PX = 6;
const DISMISS_SIZE = 32;
const DISMISS_ICON = 16;

function sheetClass(
  position: DismissibleBannerPosition,
  tone: DismissibleBannerTone
): string {
  const edge =
    position === 'top'
      ? 'border-b border-solid border-border'
      : 'border-t border-solid border-border';
  return `box w-full ${TONE_BG[tone]} ${edge}`;
}

function sheetStyle(position: DismissibleBannerPosition): JSX.CSSProperties {
  return position === 'top'
    ? {
        'padding-top': `calc(env(safe-area-inset-top, 0px) + ${EDGE_SAFE_PAD_PX}px)`,
      }
    : {
        'padding-bottom': `calc(env(safe-area-inset-bottom, 0px) + ${EDGE_SAFE_PAD_PX}px)`,
      };
}

function contentPadStyle(wide: boolean): JSX.CSSProperties {
  const x = spacingScale(
    wide ? APP_FRAME_GUTTER_STEP : CONTENT_EDGE_PADDING_STEP
  );
  if (!wide) {
    return {
      'padding-left': cssPx(x),
      'padding-right': cssPx(x),
    };
  }
  return {
    'max-width': `min(${cssPx(APP_MAX_WIDTH)}, 100%)`,
    'margin-left': 'auto',
    'margin-right': 'auto',
    'padding-left': cssPx(x),
    'padding-right': cssPx(x),
  };
}

function DismissibleBannerFrame(
  props: DismissibleBannerProps & {
    position: DismissibleBannerPosition;
    tone: DismissibleBannerTone;
    dismiss: () => void;
  }
): JSX.Element {
  const { t } = useLingui();
  const mode = useLayoutMode();
  const wide = (): boolean => mode() === 'wide';
  return (
    <div
      class={sheetClass(props.position, props.tone)}
      style={sheetStyle(props.position)}
    >
      <div
        class="box w-full flex-row items-center gap-2 py-1"
        style={contentPadStyle(wide())}
      >
        <DismissibleBannerPromptBody
          title={props.title}
          subtitle={props.subtitle}
          actionLabel={props.actionLabel}
          onActionClick={props.onActionClick}
          actionDataSet={props.actionDataSet}
        />
        <IconButton
          size={DISMISS_SIZE}
          onClick={props.dismiss}
          label={t`Dismiss`}
          aria-label={t`Dismiss`}
          tooltip="none"
          dataSet={{ component: 'DismissibleBannerDismiss' }}
        >
          <XIcon size={DISMISS_ICON} color="icon" />
        </IconButton>
      </div>
    </div>
  );
}

export function DismissibleBanner(props: DismissibleBannerProps): JSX.Element {
  const position = (): DismissibleBannerPosition => props.position ?? 'top';
  const tone = (): DismissibleBannerTone => props.tone ?? 'paper';

  return (
    <InFlowBanner position={position()} visible={props.visible}>
      <div
        class="box w-full"
        role="status"
        {...dataAttrs({
          component: 'DismissibleBanner',
          position: position(),
          ...props.dataSet,
        })}
      >
        <DismissibleBannerFrame
          {...props}
          position={position()}
          tone={tone()}
          dismiss={() => props.onDismiss()}
        />
      </div>
    </InFlowBanner>
  );
}
