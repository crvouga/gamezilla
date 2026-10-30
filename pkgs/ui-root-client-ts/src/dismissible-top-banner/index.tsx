/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { iconSize } from '@pkgs/ui-root-shared-ts/sizes';
import {
  createContext,
  createEffect,
  createSignal,
  type JSX,
  Show,
  useContext,
} from 'solid-js';
import { Dynamic, Portal } from 'solid-js/web';
import { Button } from '../button/index';
import type { IconComponent } from '../create-icon/index';
import { IconButton } from '../icon-button/index';
import { InfoIcon, TriangleAlertIcon, XIcon } from '../icons';

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

/**
 * In-flow top/bottom banners. Mount {@link DismissibleBannerPortalProvider}
 * once at the app root (inside the theme root); banners portal into its host
 * slots and push app content rather than covering it.
 *
 * Prefer hosting the portal on {@link AppFrame} so wide-mode hosts sit outside
 * the max-width column (full-bleed sheet) while banner content still aligns to
 * the wide measure (`max-w-ui-wide`). Use {@link InFlowBanner} for custom chrome (e.g. perf
 * HUD) and {@link DismissibleBanner} for the standard dismissible sheet. Mount
 * and dismiss are instant (no slide animation) for low-end Android.
 */
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
  /**
   * Paint the banner sheet around the children, as `DismissibleBanner` does:
   * the tone's fill, a hairline on the content side and the safe area on the
   * edge. Unset, the children paint themselves.
   */
  sheet?: DismissibleBannerTone | undefined;
  /** Rendered as `data-testid` on the sheet. */
  testId?: string | undefined;
};

function InFlowBannerSheet(props: InFlowBannerProps): JSX.Element {
  return (
    <Show when={props.sheet} fallback={props.children}>
      {(tone) => (
        <div
          class={sheetClass(props.position ?? 'top', tone())}
          data-testid={props.testId}
        >
          {props.children}
        </div>
      )}
    </Show>
  );
}

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
              <InFlowBannerSheet {...props} />
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
  /**
   * Sheet tint. `paper` (default) is the quiet `surface` well; `warning` and
   * `info` are their status washes, with a leading glyph in the same hue.
   */
  tone?: DismissibleBannerTone | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** Copy on a status wash takes the wash's hue; paper keeps the text tiers. */
function toneTextClass(tone: DismissibleBannerTone): Record<string, boolean> {
  return {
    'text-warning': tone === 'warning',
    'text-info': tone === 'info',
  };
}

function DismissibleBannerPromptBody(props: {
  tone: DismissibleBannerTone;
  title: JSX.Element;
  subtitle: JSX.Element | undefined;
  actionLabel: JSX.Element | undefined;
  onActionClick: (() => void) | undefined;
  actionDataSet: ComponentDataSet | undefined;
}): JSX.Element {
  return (
    <div class="box flex-1 min-w-0 flex-row items-center gap-2 flex-wrap">
      <div class="box flex-1 min-w-0">
        <p class="text textBodyBold" classList={toneTextClass(props.tone)}>
          {props.title}
        </p>
        <Show when={props.subtitle !== undefined && props.subtitle !== null}>
          <p class="text textCaption" classList={toneTextClass(props.tone)}>
            {props.subtitle}
          </p>
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

type BannerToneSpec = {
  readonly surface: string;
  readonly icon: IconComponent | undefined;
  readonly iconColor: string;
};

const TONE: Record<DismissibleBannerTone, BannerToneSpec> = {
  paper: { surface: 'bg-surface', icon: undefined, iconColor: 'icon' },
  warning: {
    surface: 'bg-warning-surface',
    icon: TriangleAlertIcon,
    iconColor: 'warning',
  },
  info: { surface: 'bg-info-surface', icon: InfoIcon, iconColor: 'info' },
};

/** A full-bleed sheet: hairline on the content side, safe area on the edge. */
function sheetClass(
  position: DismissibleBannerPosition,
  tone: DismissibleBannerTone
): string {
  const edge =
    position === 'top'
      ? 'safeTop border-b border-solid border-border'
      : 'safeBottom border-t border-solid border-border';
  return `box w-full ${TONE[tone].surface} ${edge}`;
}

function BannerToneIcon(props: { tone: DismissibleBannerTone }): JSX.Element {
  return (
    <Show when={TONE[props.tone].icon}>
      {(icon) => (
        <Dynamic
          component={icon()}
          size={iconSize.md}
          color={TONE[props.tone].iconColor}
        />
      )}
    </Show>
  );
}

function DismissibleBannerFrame(
  props: DismissibleBannerProps & {
    position: DismissibleBannerPosition;
    tone: DismissibleBannerTone;
    dismiss: () => void;
  }
): JSX.Element {
  const { t } = useLingui();
  return (
    <div class={sheetClass(props.position, props.tone)}>
      {/* Content follows the wide column's measure and 16px gutter. */}
      <div class="box w-full max-w-ui-wide mx-auto flex-row items-center gap-3 py-1 pl-4 pr-2">
        <BannerToneIcon tone={props.tone} />
        <DismissibleBannerPromptBody
          tone={props.tone}
          title={props.title}
          subtitle={props.subtitle}
          actionLabel={props.actionLabel}
          onActionClick={props.onActionClick}
          actionDataSet={props.actionDataSet}
        />
        <IconButton
          onClick={props.dismiss}
          label={t`Dismiss`}
          aria-label={t`Dismiss`}
          tooltip="none"
          dataSet={{ component: 'DismissibleBannerDismiss' }}
        >
          <XIcon size={iconSize.md} color="icon" />
        </IconButton>
      </div>
    </div>
  );
}

/**
 * Show a dismissible status message in the shell's top or bottom banner host.
 * Mount DismissibleBannerPortalProvider once around the shell; use InFlowBanner
 * when the content needs custom chrome instead of the standard message sheet.
 * @summary Show a dismissible status message in shell chrome
 */
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
