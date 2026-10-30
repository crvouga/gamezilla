/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { RadiusToken } from '@pkgs/ui-root-shared-ts/token-names';
import { type JSX, Show } from 'solid-js';
import type { DataSetProps } from '../data-set-binding';
import { bindDataSet } from '../data-set-binding';
import type { ElementTargetProps } from '../element-targets';
import { bindElementTargets } from '../element-targets';
import {
  directionClass,
  flexContainerClass,
  flexItemClass,
  radiusClass,
  spaced,
} from '../layout-classes';
import type { Align, Direction, FlexItemProps, Justify } from '../layout-props';
import type { SpacingProps } from '../space-classes';
import { spacingClass } from '../space-classes';

/** Which kind of "current" the region is, for `aria-current`. */
export type PressableCurrent = 'page' | 'step' | 'location' | 'date' | 'time';

/** What the region opens, for `aria-haspopup`. */
export type PressablePopup = 'menu' | 'listbox' | 'dialog' | 'tree' | 'grid';

export type PressableProps = SpacingProps &
  FlexItemProps &
  ElementTargetProps &
  DataSetProps & {
    children?: JSX.Element | undefined;
    /** Runs on click, tap and keyboard activation. */
    onPress?: (() => void) | undefined;
    /** Makes the region a link to this URL. */
    href?: string | undefined;
    /** Hover and press tint over the region. Default `true`. */
    tint?: boolean | undefined;
    disabled?: boolean | undefined;
    /** Toggle state (`aria-pressed`). Buttons only. */
    pressed?: boolean | undefined;
    /** The chosen item of a set (`aria-current="true"`). */
    selected?: boolean | undefined;
    /** The current page, step or location; wins over `selected`. */
    current?: PressableCurrent | undefined;
    /** `submit` submits the enclosing form. Buttons only. Default `button`. */
    type?: 'button' | 'submit' | undefined;
    /** The main axis of the children. Default `vertical`. */
    direction?: Direction | undefined;
    align?: Align | undefined;
    justify?: Justify | undefined;
    /** Corner radius; the focus ring and the tint follow it. */
    radius?: RadiusToken | undefined;
    /** `false` removes the region from the tab order. Default `true`. */
    tabStop?: boolean | undefined;
    /** Focus entered (`true`) or left (`false`) the region. */
    onFocusChange?: ((focused: boolean) => void) | undefined;
    id?: string | undefined;
    /** Rendered as `data-testid`. */
    testId?: string | undefined;
    'aria-label'?: string | undefined;
    'aria-labelledby'?: string | undefined;
    'aria-describedby'?: string | undefined;
    'aria-expanded'?: boolean | undefined;
    'aria-controls'?: string | undefined;
    'aria-haspopup'?: PressablePopup | undefined;
  };

function pressableClass(region: PressableProps): string {
  const disabled = region.disabled === true;
  return spaced([
    'clickable',
    region.tint !== false && !disabled ? 'clickableTint' : undefined,
    directionClass(region.direction ?? 'vertical'),
    flexContainerClass(region),
    flexItemClass(region),
    spacingClass(region),
    radiusClass(region.radius),
    disabled ? 'opacity-disabled cursor-default' : undefined,
    disabled && region.href !== undefined ? 'pointer-events-none' : undefined,
  ]);
}

function ariaCurrent(
  region: PressableProps
): PressableCurrent | true | undefined {
  if (region.current !== undefined) return region.current;
  return region.selected === true ? true : undefined;
}

/** A click the browser should keep: new tab, new window, download. */
function isModifiedClick(event: MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function PressableLink(props: PressableProps): JSX.Element {
  const onClick = (event: MouseEvent): void => {
    if (props.disabled === true) {
      event.preventDefault();
      return;
    }
    if (props.onPress === undefined || isModifiedClick(event)) return;
    event.preventDefault();
    props.onPress();
  };
  return (
    <a
      ref={(element) => {
        bindElementTargets(element, props);
        bindDataSet(element, props);
      }}
      class={pressableClass(props)}
      href={props.disabled === true ? undefined : props.href}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Pressable')}
      tabIndex={props.tabStop === false ? -1 : undefined}
      onClick={onClick}
      onFocus={() => props.onFocusChange?.(true)}
      onBlur={() => props.onFocusChange?.(false)}
      aria-disabled={props.disabled === true ? true : undefined}
      aria-current={ariaCurrent(props)}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-expanded={props['aria-expanded']}
      aria-controls={props['aria-controls']}
      aria-haspopup={props['aria-haspopup']}
    >
      {props.children}
    </a>
  );
}

function PressableButton(props: PressableProps): JSX.Element {
  return (
    <button
      ref={(element) => {
        bindElementTargets(element, props);
        bindDataSet(element, props);
      }}
      class={pressableClass(props)}
      type={props.type ?? 'button'}
      disabled={props.disabled === true}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Pressable')}
      tabIndex={props.tabStop === false ? -1 : undefined}
      onClick={() => props.onPress?.()}
      onFocus={() => props.onFocusChange?.(true)}
      onBlur={() => props.onFocusChange?.(false)}
      aria-pressed={props.pressed}
      aria-current={ariaCurrent(props)}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-expanded={props['aria-expanded']}
      aria-controls={props['aria-controls']}
      aria-haspopup={props['aria-haspopup']}
    >
      {props.children}
    </button>
  );
}

/**
 * `Pressable` -- the bare interactive region: a `<button>`, or an `<a>` when
 * it has an `href`. It carries the press behavior, the focus ring and the
 * press tint, and lays its children out like a stack; it paints nothing of
 * its own. Reach for `Button`, `IconButton`, `MenuRow` or `Chip` first; use
 * this when the thing pressed is a custom composition.
 *
 * - **Activation** is the platform's: click or tap, Enter and Space on a
 *   button, Enter on a link. `onPress` runs for all of them.
 * - **Links** stay real links. With `href` alone the browser (and the
 *   router's link handling) navigates; `onPress` alongside takes over a plain
 *   click and leaves modified clicks (new tab, new window) to the browser.
 * - **State** is ARIA, never color alone: `pressed` is a toggle
 *   (`aria-pressed`), `selected` the chosen item of a set
 *   (`aria-current="true"`), `current` the current page, step or location.
 * - **Focus** shows the system focus ring. `focusTarget` moves focus here
 *   from the screen; `tabStop={false}` takes the region out of the tab order
 *   for a group that manages its own arrow-key focus.
 *
 * @example
 * ```tsx
 * <Pressable onPress={open} direction="horizontal" align="center" gap="sm" paddingX="lg" minHeight="row">
 *   <Avatar … />
 *   <P variant="label" lines={1}>{name()}</P>
 * </Pressable>
 * <Pressable href="/games" current="page" aria-label={t`Games`}>…</Pressable>
 * ```
 */
export function Pressable(props: PressableProps): JSX.Element {
  return (
    <Show
      when={props.href !== undefined}
      fallback={<PressableButton {...props} />}
    >
      <PressableLink {...props} />
    </Show>
  );
}
