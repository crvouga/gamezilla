/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import { pushEscapeDismissHandler } from '@pkgs/ui-root-shared-ts/escape-dismiss-stack';
import { collectTabbable } from '@pkgs/ui-root-shared-ts/focus-trap-logic';
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  Show,
  untrack,
} from 'solid-js';
import type { FloatingMenuPlacement } from '../floating-menu-position';
import { computeFloatingMenuPosition } from '../floating-menu-position';
import { OnColorReset } from '../on-color-context/index';
import type { LayoutRect } from '../portal-host-frame';
import { measureHostFrame, windowRectToHostLocal } from '../portal-host-frame';
import {
  SurfaceStackSlot,
  useSurfaceStackHostFrame,
} from '../surface-stack/index';
import { useThemeLayout } from '../theme-context/index';

/** What the trigger render prop is handed. */
export type PopoverTriggerProps = {
  readonly onPress: () => void;
  readonly 'aria-haspopup': 'dialog';
  readonly 'aria-expanded': boolean;
  readonly 'aria-controls': string | undefined;
};

/** Panel width: 240, 320 or 400, never wider than the viewport. */
export type PopoverSize = 'sm' | 'md' | 'lg';

export type PopoverProps = {
  /** The control that opens the panel. */
  trigger: (trigger: PopoverTriggerProps) => JSX.Element;
  /** Panel content. */
  children: JSX.Element;
  /** Accessible name of the panel. */
  label: string;
  /** Default `bottom-start`. */
  placement?: FloatingMenuPlacement | undefined;
  /** Default `md`. */
  size?: PopoverSize | undefined;
  /** Open state, when the caller owns it. */
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Rendered as `data-testid` on the panel. */
  testId?: string | undefined;
};

const WIDTH: Readonly<Record<PopoverSize, number>> = {
  sm: 240,
  md: 320,
  lg: 400,
};

const NO_INSETS = { top: 0, bottom: 0 };

type CloseReason = 'escape' | 'trigger' | 'outside';

function contains(root: Element | undefined, target: EventTarget | null) {
  return root !== undefined && target instanceof Node && root.contains(target);
}

/** Focus in on open; Escape, outside press and focus return while open. */
function usePopoverLifecycle(args: {
  panel: () => HTMLElement | undefined;
  anchor: () => HTMLElement | undefined;
  close: (reason: CloseReason) => void;
}): void {
  createEffect(() => {
    const panel = args.panel();
    if (panel === undefined) return;
    (collectTabbable(panel)[0] ?? panel).focus();
    const onPointerDown = (event: PointerEvent): void => {
      if (contains(panel, event.target)) return;
      if (contains(args.anchor(), event.target)) return;
      args.close('outside');
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    const unsubscribe = pushEscapeDismissHandler(() => args.close('escape'));
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      unsubscribe();
    });
  });
}

function PopoverPanel(props: {
  id: string;
  label: string;
  width: number;
  anchor: LayoutRect;
  placement: FloatingMenuPlacement;
  testId: string | undefined;
  ref: (el: HTMLElement | undefined) => void;
  children: JSX.Element;
}): JSX.Element {
  const hostFrame = useSurfaceStackHostFrame();
  const layout = useThemeLayout();
  const [height, setHeight] = createSignal(0);
  let panel: HTMLDivElement | undefined;
  createEffect(() => {
    if (panel === undefined) return;
    setHeight(panel.getBoundingClientRect().height);
    props.ref(panel);
    onCleanup(() => props.ref(undefined));
  });
  const viewport = () => {
    const host = hostFrame();
    return {
      width: host.width > 0 ? host.width : layout.layout().width,
      height: host.height > 0 ? host.height : layout.layout().height,
    };
  };
  const width = (): number =>
    Math.min(props.width, Math.max(0, viewport().width - 16));
  const position = () =>
    computeFloatingMenuPosition({
      anchor: props.anchor,
      menuHeight: height(),
      menuWidth: width(),
      insets: NO_INSETS,
      placement: props.placement,
      viewport: viewport(),
    });
  return (
    <div class="box absolute inset-0 boxNone">
      <OnColorReset>
        <div
          ref={(el) => {
            panel = el;
          }}
          class="box absolute z-1 p-ui-lg gap-ui-md rounded-card border border-border bg-surface-overlay shadow-float outline-none"
          style={{
            top: `${position().top}px`,
            left: `${position().left}px`,
            width: `${width()}px`,
          }}
          id={props.id}
          data-testid={props.testId}
          data-component={componentId('Popover')}
          role="dialog"
          aria-label={props.label}
          tabIndex={-1}
        >
          {props.children}
        </div>
      </OnColorReset>
    </div>
  );
}

/**
 * `Popover` -- a small non-modal panel anchored to the control that opened
 * it: a filter form, a definition, a short set of options. The page behind
 * stays live; nothing is dimmed and focus is not trapped. For a list of
 * commands use `FloatingMenu`; for a task that must be finished or
 * cancelled use `ResponsiveSurface`.
 *
 * - **Trigger**: `trigger` is a render prop. Spread what it is handed onto a
 *   `Pressable` (or any control that takes `onPress` and the ARIA props): it
 *   toggles the panel and carries `aria-haspopup="dialog"`,
 *   `aria-expanded` and `aria-controls`.
 * - **Focus** moves to the first focusable element in the panel (or the
 *   panel) on open, and back to the trigger when Escape or the trigger
 *   closes it. A press outside closes it and leaves focus where it landed.
 * - **Placement** is static (`bottom-start` default) and clamped to the
 *   viewport, the same as `FloatingMenu`; the panel lives in the surface
 *   stack so it paints above the page and below later surfaces.
 * - `open` + `onOpenChange` control it; without `open` it keeps its own state.
 *
 * Visual: the overlay surface, a hairline border, the card radius and the
 * one float shadow.
 *
 * @example
 * ```tsx
 * <Popover
 *   label={t`Filters`}
 *   trigger={(trigger) => (
 *     <Pressable {...trigger} paddingX="md" minHeight="control" radius="control">
 *       <Text variant="label">{t`Filters`}</Text>
 *     </Pressable>
 *   )}
 * >
 *   <RadioGroup …>…</RadioGroup>
 * </Popover>
 * ```
 */
export function Popover(props: PopoverProps): JSX.Element {
  const id = `popover-${createUniqueId()}`;
  const hostFrame = useSurfaceStackHostFrame();
  const [own, setOwn] = createSignal(untrack(() => props.open ?? false));
  const [panel, setPanel] = createSignal<HTMLElement | undefined>();
  const [anchor, setAnchor] = createSignal<HTMLElement | undefined>();
  const open = (): boolean => props.open ?? own();
  const setOpen = (next: boolean): void => {
    setOwn(next);
    props.onOpenChange?.(next);
  };
  const close = (reason: CloseReason): void => {
    if (!open()) return;
    setOpen(false);
    const el = anchor();
    if (reason !== 'outside' && el !== undefined) {
      (collectTabbable(el)[0] ?? el).focus();
    }
  };
  usePopoverLifecycle({ panel, anchor, close });
  const anchorRect = createMemo((): LayoutRect | null => {
    const el = anchor();
    if (!open() || el === undefined) return null;
    return windowRectToHostLocal(measureHostFrame(el), hostFrame());
  });
  const trigger: PopoverTriggerProps = {
    onPress: () => (open() ? close('trigger') : setOpen(true)),
    'aria-haspopup': 'dialog',
    get 'aria-expanded'() {
      return open();
    },
    get 'aria-controls'() {
      return open() ? id : undefined;
    },
  };
  return (
    <>
      <span
        ref={setAnchor}
        class="inline-flex self-start"
        data-component={componentId('PopoverAnchor')}
      >
        {props.trigger(trigger)}
      </span>
      <Show when={anchorRect()}>
        {(rect) => (
          <SurfaceStackSlot id={id} visible>
            <PopoverPanel
              id={id}
              label={props.label}
              width={WIDTH[props.size ?? 'md']}
              anchor={rect()}
              placement={props.placement ?? 'bottom-start'}
              testId={props.testId}
              ref={setPanel}
            >
              {props.children}
            </PopoverPanel>
          </SurfaceStackSlot>
        )}
      </Show>
    </>
  );
}
