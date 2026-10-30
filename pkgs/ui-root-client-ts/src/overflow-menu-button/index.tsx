/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { IconComponent } from '../create-icon/index';
import { FloatingMenu } from '../floating-menu/index';
import type { FloatingMenuPlacement } from '../floating-menu-position';
import { IconButton } from '../icon-button/index';
import { EllipsisIcon, MenuIcon } from '../icons';
import type { TooltipPlacement } from '../tooltip/index';
import type { AnchoredMenuController } from '../use-anchored-menu';
import { useAnchoredMenu } from '../use-anchored-menu';

export const OVERFLOW_MENU_DEFAULT_WIDTH = 280;

export type OverflowMenuAction = {
  /** Stable id used for the row key + a11y. */
  id: string;
  label: JSX.Element;
  /** Secondary line under the label (e.g. email). */
  subtitle?: JSX.Element | undefined;
  /** Defaults to the ellipsis icon when omitted. */
  icon?: IconComponent | undefined;
  /** When set, replaces the icon glyph in the menu row (e.g. avatar). */
  leading?: JSX.Element | undefined;
  onClick: () => void;
  trailing?: JSX.Element | undefined;
  disabled?: boolean | undefined;
  /** When true, inserts a divider row after this action. */
  endsGroup?: boolean | undefined;
  'aria-label'?: string | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export type OverflowMenuHeader = {
  title: JSX.Element;
  subtitle?: JSX.Element | undefined;
  avatar?: JSX.Element | undefined;
  /** Status chip on its own row under the title (e.g. a plan tier). */
  badge?: JSX.Element | undefined;
};

export type OverflowMenuContentRow =
  | {
      type: 'item';
      id: string;
      label: JSX.Element;
      icon: IconComponent;
      onClick: () => void;
      subtitle?: JSX.Element | undefined;
      leading?: JSX.Element | undefined;
      trailing?: JSX.Element | undefined;
      disabled?: boolean | undefined;
      'aria-label'?: string | undefined;
      dataSet?: ComponentDataSet | undefined;
    }
  | { type: 'divider'; id: string };

export type OverflowMenuContent = {
  /** Optional panel header; `ActionBar` overflow menus omit it. */
  header?: OverflowMenuHeader | undefined;
  rows: readonly OverflowMenuContentRow[];
};

/** What `renderMenu` receives: open state, anchor, content, and geometry. */
export type OverflowMenuRenderProps = {
  open: boolean;
  onClose: () => void;
  anchor: HTMLElement | null;
  width: number;
  content: OverflowMenuContent;
  placement: FloatingMenuPlacement;
};

export type OverflowMenuButtonProps = {
  /** Actions rendered inside the dropdown. */
  actions: readonly OverflowMenuAction[];
  /** Panel header (title + optional subtitle). */
  header: OverflowMenuHeader;
  /** Trigger diameter in px. Defaults to 40. Ignored when `trigger` is set. */
  size?: number | undefined;
  /** Trigger icon. Defaults to the hamburger `MenuIcon`. Ignored when `trigger`. */
  icon?: IconComponent | undefined;
  /**
   * Custom trigger face. When set, wraps the node in a `Clickable` that opens
   * the menu (default IconButton is skipped).
   */
  trigger?: JSX.Element | undefined;
  /** Trigger accessible name. */
  'aria-label': string;
  /** Width of the dropdown panel in px. */
  width?: number | undefined;
  /** Static menu placement. Defaults to `bottom-end`. */
  placement?: FloatingMenuPlacement | undefined;
  /**
   * Static tooltip placement on the default IconButton trigger. Defaults to
   * the menu `placement` so edge chrome (e.g. trailing account) does not clip.
   */
  tooltipPlacement?: TooltipPlacement | undefined;
  /** Overrides the default {@link FloatingMenu} dropdown. */
  renderMenu?: ((menu: OverflowMenuRenderProps) => JSX.Element) | undefined;
  /** Notified when the trigger is clicked (after the menu opens). */
  onClick?: (() => void) | undefined;
  /** DOM `data-*` identifiers, applied to the clickable trigger (`data-testid`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const DEFAULT_ACTION_ICON = EllipsisIcon;

/** The trigger glyph on the icon scale: 24 on the 40px disc, smaller below. */
function triggerIconSize(size: number): number {
  if (size >= 40) return 24;
  return size >= 32 ? 20 : 16;
}

/** Pure: turn `actions` into menu rows, closing the menu before each `onClick`. */
export function buildOverflowMenuContent(
  actions: readonly OverflowMenuAction[],
  onClose: () => void,
  header?: OverflowMenuHeader
): OverflowMenuContent {
  const rows: OverflowMenuContentRow[] = [];
  actions.forEach((a, idx) => {
    rows.push({
      type: 'item',
      id: a.id,
      label: a.label,
      icon: a.icon ?? DEFAULT_ACTION_ICON,
      onClick: () => {
        onClose();
        a.onClick();
      },
      subtitle: a.subtitle,
      leading: a.leading,
      trailing: a.trailing,
      disabled: a.disabled,
      'aria-label': a['aria-label'],
      dataSet: a.dataSet,
    });
    if (a.endsGroup === true && idx < actions.length - 1) {
      rows.push({ type: 'divider', id: `${a.id}-end-group` });
    }
  });
  return header === undefined ? { rows } : { header, rows };
}

/** Default `renderMenu`: a {@link FloatingMenu} anchored to the trigger. */
export function renderDefaultOverflowMenu(
  menu: OverflowMenuRenderProps
): JSX.Element {
  return (
    <FloatingMenu
      open={menu.open}
      onClose={menu.onClose}
      anchor={menu.anchor}
      width={menu.width}
      placement={menu.placement}
      content={menu.content}
    />
  );
}

function TriggerFace(props: {
  menu: AnchoredMenuController;
  size: number;
  icon: IconComponent;
  trigger: JSX.Element | undefined;
  'aria-label': string;
  tooltipPlacement: TooltipPlacement;
  onOpen: () => void;
  dataSet: ComponentDataSet | undefined;
}): JSX.Element {
  return (
    <Show
      when={props.trigger !== undefined}
      fallback={
        <IconButton
          size={props.size}
          onClick={props.onOpen}
          label={props['aria-label']}
          aria-label={props['aria-label']}
          aria-haspopup="menu"
          aria-expanded={props.menu.open()}
          tooltipPlacement={props.tooltipPlacement}
          dataSet={props.dataSet}
        >
          <Dynamic
            component={props.icon}
            size={triggerIconSize(props.size)}
            color="icon"
          />
        </IconButton>
      }
    >
      <button
        class="clickable clickableTint rounded-full overflow-hidden"
        {...dataAttrs(props.dataSet)}
        type="button"
        onClick={() => props.onOpen()}
        aria-label={props['aria-label']}
        aria-haspopup="menu"
        aria-expanded={props.menu.open()}
      >
        {props.trigger}
      </button>
    </Show>
  );
}

/**
 * `OverflowMenuButton` -- icon (or custom) trigger for a "more actions" menu.
 *
 * Owns the trigger face + open/close state ({@link useAnchoredMenu}) and
 * turns `actions` into a {@link OverflowMenuContent} (rows + optional
 * dividers). By default the dropdown is a {@link FloatingMenu} anchored to
 * the trigger; pass `renderMenu` to supply any other anchored panel. The
 * trigger renders nothing when `actions` is empty so consumers can keep the
 * component mounted conditionally.
 *
 * @example
 * ```tsx
 * <OverflowMenuButton
 *   aria-label={t`More`}
 *   header={{ title: t`More` }}
 *   actions={[
 *     { id: 'devtools', label: 'Developer tools', icon: CodeIcon, onClick: openDebug, endsGroup: true },
 *     { id: 'leave', label: 'Leave space', icon: LogOutIcon, onClick: leave },
 *   ]}
 * />
 * ```
 */
export function OverflowMenuButton(
  props: OverflowMenuButtonProps
): JSX.Element {
  const menu = useAnchoredMenu();
  const content = (): OverflowMenuContent =>
    buildOverflowMenuContent(props.actions, menu.close, props.header);
  const onOpen = (): void => {
    menu.openMenu();
    props.onClick?.();
  };
  const renderMenu = () => props.renderMenu ?? renderDefaultOverflowMenu;
  return (
    <Show when={props.actions.length > 0}>
      <div
        class="box"
        data-component="OverflowMenuButton"
        ref={menu.setTrigger}
      >
        <TriggerFace
          menu={menu}
          size={props.size ?? 40}
          icon={props.icon ?? MenuIcon}
          trigger={props.trigger}
          aria-label={props['aria-label']}
          tooltipPlacement={
            props.tooltipPlacement ?? props.placement ?? 'bottom-end'
          }
          onOpen={onOpen}
          dataSet={props.dataSet}
        />
      </div>
      {renderMenu()({
        get open() {
          return menu.open();
        },
        onClose: menu.close,
        get anchor() {
          return menu.anchor();
        },
        get width() {
          return props.width ?? OVERFLOW_MENU_DEFAULT_WIDTH;
        },
        get content() {
          return content();
        },
        get placement() {
          return props.placement ?? 'bottom-end';
        },
      })}
    </Show>
  );
}
