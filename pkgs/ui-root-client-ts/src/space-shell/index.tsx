/** @jsxImportSource @solidjs/web */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import { useAppFrameGlobalStatus } from '../app-frame-chrome/index';
import { BackIconButton } from '../back-icon-button/index';
import { createElementWidth } from '../create-element-width';
import { FloatingMenu } from '../floating-menu/index';
import type {
  FloatingMenuContent,
  FloatingMenuItemRow,
} from '../floating-menu-content';
import { IconButton } from '../icon-button/index';
import { CircleStopIcon, EllipsisIcon, LogOutIcon } from '../icons';
import { spaceDataSet } from '../space-data-set';
import type { SpacePersonCapability } from '../space-person-actions';
import type { SpaceMenuItem, SpaceRole } from '../space-types';
import { useAnchoredMenu } from '../use-anchored-menu';
import styles from './space-shell.module.css';

/**
 * The `data-testid` of each row-1 control, so harness bindings keep their
 * handles whichever screen draws the shell.
 */
export type SpaceShellTestIds = {
  back?: string | undefined;
  /** The screen's title (the `h1`). */
  title?: string | undefined;
  /** The button that opens the space menu. */
  settings?: string | undefined;
  /** The space's name, heading the space menu. */
  name?: string | undefined;
  /** A guest's Leave, in the space menu. */
  leave?: string | undefined;
  /** The host's End, in the space menu. */
  end?: string | undefined;
};

/** Row 1 of a space and what it opens, the same on every space screen. */
export type SpaceShellChrome = {
  /** The space's name: the title of a screen that names nothing itself. */
  spaceName: string;
  /**
   * What this screen is, in row 1: `Choose game`, `Chess`, `Game history`.
   * It changes with the screen; the space's name stands in when unset.
   */
  title?: string | undefined;
  onBack: () => void;
  /**
   * What back says it goes to; "Back to spaces" by default. A stage that
   * goes back inside the space names that place instead (`Back to Chess`).
   */
  backLabel?: string | undefined;
  /**
   * The space's own actions, most used first (the people in the space
   * lead). As many as fit sit in row 1 as buttons; the rest wait in the
   * space menu, above the way out.
   */
  menu?: readonly SpaceMenuItem[] | undefined;
  /** A guest leaves the space: the space menu's last row for a guest. */
  onLeave: () => void;
  /** The host ends the space for everyone: the menu's last row for them. */
  onEnd: () => void;
  /**
   * Under row 1: a refused change, the host gone offline. Rendered once;
   * nothing shows while it renders nothing.
   */
  notice?: JSX.Element | undefined;
  testIds?: SpaceShellTestIds | undefined;
};

/**
 * What a whole space screen (a template) needs beyond its game: row 1 and
 * what the space can do for a person.
 */
export type SpaceScreenChrome = SpaceShellChrome & {
  /**
   * A space action was chosen on a person (`SpacePersonActionId`:
   * `readyUp`, `removeFromSpace`, `inviteFriend`, …).
   */
  onPersonAction: (personId: string, action: string) => void;
  /** Opens the way to bring someone in. */
  onInvite?: (() => void) | undefined;
  /** The optional person actions the product can carry out; none by default. */
  personCapabilities?: readonly SpacePersonCapability[] | undefined;
};

export type SpaceShellProps = SpaceShellChrome & {
  /** Who is looking: a guest gets Leave, the host End. */
  role: SpaceRole;
  /** Row 2: what the space is doing now. */
  children: JSX.Element;
  /**
   * `heading` (default): the title is the screen's `h1`. `context`: the
   * screen in the stage brings its own heading (one not yet on a
   * template), so the title is plain text beside back and never the first
   * heading on the page.
   */
  nameAs?: 'heading' | 'context' | undefined;
  /**
   * `scroll` (default): the stage scrolls on its own when its content is
   * taller than the room left (choices, history, settings pages). `fixed`:
   * the content owns the room (a board over an action bar) and nothing
   * scrolls.
   */
  stage?: 'scroll' | 'fixed' | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/** One action's width in row 1: a 44px button and the gap beside it. */
const ACTION_SLOT_PX = 48;
/** Row 1's own padding and the gaps around the title. */
const ROW_SPARE_PX = 32;
/** The most of row 1 a long title may hold before it is cut short. */
const TITLE_MAX_SHARE = 0.6;

/**
 * How many of `count` actions sit in row 1 as buttons when `room` px are
 * left for them. The first always does: it is the one people reach for.
 */
export function spaceInlineActionCount(count: number, room: number): number {
  if (count === 0) return 0;
  return Math.min(count, Math.max(1, Math.floor(room / ACTION_SLOT_PX)));
}

function exitRow(props: SpaceShellProps, label: string): FloatingMenuItemRow {
  return props.role === 'host'
    ? {
        type: 'item',
        id: 'end',
        label,
        icon: CircleStopIcon,
        tone: 'destructive',
        onClick: () => props.onEnd(),
        dataSet: spaceDataSet({ action: 'end' }, props.testIds?.end),
      }
    : {
        type: 'item',
        id: 'leave',
        label,
        icon: LogOutIcon,
        tone: 'destructive',
        onClick: () => props.onLeave(),
        dataSet: spaceDataSet({ action: 'leave' }, props.testIds?.leave),
      };
}

/**
 * The space menu: headed by the space's name (row 1 says what the screen
 * is, so here is which space it is in), then the actions that did not fit
 * in row 1, then the way out.
 */
function useSpaceMenu(
  props: SpaceShellProps,
  overflow: () => readonly SpaceMenuItem[]
): () => FloatingMenuContent {
  const { t } = useLingui();
  return createMemo((): FloatingMenuContent => {
    const exit = exitRow(
      props,
      props.role === 'host' ? t`End space` : t`Leave space`
    );
    const own = overflow().map(
      (item): FloatingMenuItemRow => ({
        type: 'item',
        id: item.id,
        label: item.label,
        icon: item.icon ?? EllipsisIcon,
        tone: item.tone,
        disabled: item.disabled === true,
        onClick: () => item.onPress(),
        dataSet: spaceDataSet({ action: item.id }, item.testId),
      })
    );
    return {
      ...(props.spaceName === ''
        ? {}
        : {
            header: {
              title: (
                <p
                  class="text textBodyBold line-clamp-1"
                  data-testid={props.testIds?.name}
                >
                  {props.spaceName}
                </p>
              ),
            },
          }),
      rows:
        own.length === 0
          ? [exit]
          : [...own, { type: 'divider', id: 'exit-divider' }, exit],
    };
  });
}

/** One of the space's actions as a button in row 1. */
function SpaceInlineAction(props: { item: SpaceMenuItem }): JSX.Element {
  const Icon = (): JSX.Element => {
    const Drawn = props.item.icon ?? EllipsisIcon;
    return (
      <Drawn
        size={24}
        color={props.item.tone === 'destructive' ? 'destructive' : 'icon'}
      />
    );
  };
  return (
    <IconButton
      label={props.item.label}
      aria-label={props.item.label}
      size={44}
      disabled={props.item.disabled === true}
      onClick={() => props.item.onPress()}
      dataSet={spaceDataSet({ action: props.item.id }, props.item.testId)}
    >
      <Icon />
    </IconButton>
  );
}

/**
 * The button for whatever did not fit in row 1 and for the way out: it
 * opens the space menu against itself (never a sheet), ending in End for
 * the host or Leave for a guest.
 */
function SpaceMenuAction(
  props: SpaceShellProps & { overflow: () => readonly SpaceMenuItem[] }
): JSX.Element {
  const { t } = useLingui();
  const menu = useAnchoredMenu();
  const content = useSpaceMenu(props, () => props.overflow());
  return (
    <>
      <span ref={menu.setTrigger} class="inline-flex">
        <IconButton
          label={t`Space menu`}
          aria-label={t`Space menu`}
          aria-haspopup="menu"
          aria-expanded={menu.open()}
          size={44}
          onClick={() => menu.toggle()}
          dataSet={spaceDataSet(
            { action: 'settings' },
            props.testIds?.settings
          )}
        >
          <EllipsisIcon size={24} color="icon" />
        </IconButton>
      </span>
      <FloatingMenu
        open={menu.open()}
        onClose={menu.close}
        anchor={menu.anchor()}
        placement="bottom-end"
        content={content()}
        label={t`Space menu`}
        dataSet={{ component: 'SpaceMenu' }}
      />
    </>
  );
}

function ActionsRow(props: SpaceShellProps): JSX.Element {
  const { t } = useLingui();
  const [row, setRow] = createSignal<HTMLElement | null>(null);
  const [heading, setHeading] = createSignal<HTMLElement | null>(null);
  const [status, setStatus] = createSignal<HTMLElement | null>(null);
  const rowWidth = createElementWidth(row);
  // The app's own status (working offline, the connection missing) wherever
  // no sidebar shows it (a phone): a person in a space is still told. Its
  // account menu stays outside the space.
  const globalStatus = useAppFrameGlobalStatus();
  const statusWidth = createElementWidth(status);
  const actions = (): readonly SpaceMenuItem[] => props.menu ?? [];
  const title = (): string => props.title ?? props.spaceName;
  // The title's whole width, however much of it shows now.
  const [titleWidth, setTitleWidth] = createSignal(0);
  createEffect(
    () => [heading(), title(), rowWidth()] as const,
    ([node]) => {
      if (node !== null) setTitleWidth(node.scrollWidth);
    }
  );
  // The title comes first: actions are buttons only in the room it leaves
  // (a very long one keeps most of the row and is then cut short). Back
  // and the menu button always show.
  const inline = createMemo(() =>
    spaceInlineActionCount(
      actions().length,
      rowWidth() -
        Math.min(titleWidth(), rowWidth() * TITLE_MAX_SHARE) -
        statusWidth() -
        2 * ACTION_SLOT_PX -
        ROW_SPARE_PX
    )
  );
  return (
    <header ref={setRow} class={styles['actions']} data-space-row="actions">
      <BackIconButton
        label={props.backLabel ?? t`Back to spaces`}
        size={44}
        onClick={() => props.onBack()}
        dataSet={spaceDataSet({ action: 'back' }, props.testIds?.back)}
      />
      <div class={styles['where']}>
        <Show
          when={props.nameAs === 'context'}
          fallback={
            <h1
              ref={setHeading}
              class="text textHeading truncate min-w-0 max-w-full self-start"
              data-testid={props.testIds?.title}
            >
              {title()}
            </h1>
          }
        >
          <p
            ref={setHeading}
            class="text textHeading truncate min-w-0 max-w-full self-start"
            data-testid={props.testIds?.title}
          >
            {title()}
          </p>
        </Show>
      </div>
      <div class={styles['tools']} data-space-row="tools">
        <Show when={globalStatus()}>
          {(shown) => (
            <div ref={setStatus} class={styles['status']}>
              {shown()}
            </div>
          )}
        </Show>
        <For each={actions().slice(0, inline())}>
          {(item) => <SpaceInlineAction item={item} />}
        </For>
        <SpaceMenuAction
          {...props}
          overflow={() => actions().slice(inline())}
        />
      </div>
    </header>
  );
}

/**
 * `SpaceShell` -- the two rows every space screen is built on, in every
 * phase, mode and game:
 *
 * 1. The top bar, the smallest and steadiest row: back at the left, then
 *    what this screen is (`title`: `Choose game`, `Chess`, `Game history`),
 *    then the space's actions at the right, the people in the space first.
 *    As many actions as fit are buttons; the rest collapse into the space
 *    menu, which is headed by the space's name and always ends in Leave
 *    for a guest or End for the host.
 *    The title is never cut short to make room for a button. The bar is
 *    the space's: of the app's own chrome only its status shows here
 *    (working offline, the connection missing), ahead of the actions and
 *    wherever no sidebar shows it; the account menu stays outside a space.
 *    Under it, only while there is one, the space's `notice`.
 * 2. The stage (`children`), filling the rest and scrolling on its own.
 *
 * Who is in the space is one of the top bar's actions, never a row of its
 * own: the stage keeps the room for the game.
 *
 * @example
 * ```tsx
 * <SpaceShell spaceName="bob's space" title="Choose game" role="guest"
 *   onBack={back} menu={[people, share]} onLeave={leave} onEnd={end}
 *   notice={<Notice />}>
 *   <SpaceLauncher ... />
 * </SpaceShell>
 * ```
 */
export function SpaceShell(props: SpaceShellProps): JSX.Element {
  return (
    <div
      class={styles['shell']}
      data-role={props.role}
      {...dataAttrs({ component: 'SpaceShell', ...props.dataSet })}
    >
      <ActionsRow {...props} />
      <div class={styles['notice']} data-space-row="notice">
        {props.notice}
      </div>
      <main
        class={styles['stage']}
        data-space-row="stage"
        data-scroll={props.stage ?? 'scroll'}
      >
        {props.children}
      </main>
    </div>
  );
}
