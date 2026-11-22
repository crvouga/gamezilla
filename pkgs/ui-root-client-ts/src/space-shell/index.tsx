/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, type JSX, Show } from 'solid-js';
import { useAppFrameGlobalTrailing } from '../app-frame-chrome/index';
import { BackIconButton } from '../back-icon-button/index';
import { FloatingMenu } from '../floating-menu/index';
import type {
  FloatingMenuContent,
  FloatingMenuItemRow,
} from '../floating-menu-content';
import { IconButton } from '../icon-button/index';
import { CircleStopIcon, EllipsisIcon, LogOutIcon } from '../icons';
import { spaceDataSet } from '../space-data-set';
import { useAnchoredMenu } from '../use-anchored-menu';
import type { SpacePersonCapability } from '../space-person-actions';
import type { SpaceMenuItem, SpaceRole } from '../space-types';
import styles from './space-shell.module.css';

/**
 * The `data-testid` of each row-1 control, so harness bindings keep their
 * handles whichever screen draws the shell.
 */
export type SpaceShellTestIds = {
  back?: string | undefined;
  /** The space's name (the `h1`). */
  title?: string | undefined;
  /** The button that opens the space menu. */
  settings?: string | undefined;
  /** A guest's Leave, in the space menu. */
  leave?: string | undefined;
  /** The host's End, in the space menu. */
  end?: string | undefined;
};

/** Row 1 of a space and what it opens, the same on every space screen. */
export type SpaceShellChrome = {
  /** The space's name, in row 1. */
  spaceName: string;
  onBack: () => void;
  /**
   * What back says it goes to; "Back to spaces" by default. A stage that
   * goes back inside the space names that place instead (`Back to Chess`).
   */
  backLabel?: string | undefined;
  /**
   * The space's own rows of the space menu, above the way out: Share,
   * Rename, Minimize.
   */
  menu?: readonly SpaceMenuItem[] | undefined;
  /** A guest leaves the space: the space menu's last row for a guest. */
  onLeave: () => void;
  /** The host ends the space for everyone: the menu's last row for them. */
  onEnd: () => void;
  /**
   * Under row 1, over the people: a refused change, the host gone offline.
   * Rendered once; nothing shows while it renders nothing.
   */
  notice?: JSX.Element | undefined;
  testIds?: SpaceShellTestIds | undefined;
};

/**
 * What a whole space screen (a template) needs beyond its game: row 1 and
 * the callbacks of its people row.
 */
export type SpaceScreenChrome = SpaceShellChrome & {
  /**
   * A space action was chosen on a person (`SpacePersonActionId`:
   * `readyUp`, `removeFromSpace`, `inviteFriend`, …).
   */
  onPersonAction: (personId: string, action: string) => void;
  /** Shows Invite at the end of the people row (never in game). */
  onInvite?: (() => void) | undefined;
  /** The optional person actions the product can carry out; none by default. */
  personCapabilities?: readonly SpacePersonCapability[] | undefined;
};

export type SpaceShellProps = SpaceShellChrome & {
  /** Who is looking: a guest gets Leave, the host End. */
  role: SpaceRole;
  /** Row 2: the people row (`SpacePeople`), on every space screen. */
  people?: JSX.Element | undefined;
  /** Row 3: what the space is doing now. */
  children: JSX.Element;
  /**
   * `heading` (default): the space's name is the screen's `h1`. `context`:
   * the screen in the stage brings its own heading (one not yet on a
   * template), so the name is plain text beside back and never the first
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

/** The rows of the space menu: the space's own, then the way out. */
function useSpaceMenu(props: SpaceShellProps): () => FloatingMenuContent {
  const { t } = useLingui();
  const exit = (): FloatingMenuItemRow =>
    props.role === 'host'
      ? {
          type: 'item',
          id: 'end',
          label: t`End space`,
          icon: CircleStopIcon,
          tone: 'destructive',
          onClick: () => props.onEnd(),
          dataSet: spaceDataSet({ action: 'end' }, props.testIds?.end),
        }
      : {
          type: 'item',
          id: 'leave',
          label: t`Leave space`,
          icon: LogOutIcon,
          tone: 'destructive',
          onClick: () => props.onLeave(),
          dataSet: spaceDataSet({ action: 'leave' }, props.testIds?.leave),
        };
  return createMemo((): FloatingMenuContent => {
    const own = (props.menu ?? []).map(
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
      rows:
        own.length === 0
          ? [exit()]
          : [...own, { type: 'divider', id: 'exit-divider' }, exit()],
    };
  });
}

/**
 * The one control for everything about the space: a button that opens the
 * space menu against itself (never a sheet): the space's own rows, then
 * End for the host or Leave for a guest.
 */
function SpaceMenuAction(props: SpaceShellProps): JSX.Element {
  const { t } = useLingui();
  const menu = useAnchoredMenu();
  const content = useSpaceMenu(props);
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
  // The app's own status and account menu, at the far edge, wherever no
  // sidebar already shows them (a phone): never lost inside a space.
  const globalTrailing = useAppFrameGlobalTrailing();
  return (
    <header class={styles['actions']} data-space-row="actions">
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
              class="text textHeading truncate min-w-0"
              data-testid={props.testIds?.title}
            >
              {props.spaceName}
            </h1>
          }
        >
          <p
            class="text textHeading truncate min-w-0"
            data-testid={props.testIds?.title}
          >
            {props.spaceName}
          </p>
        </Show>
      </div>
      <SpaceMenuAction {...props} />
      {globalTrailing()}
    </header>
  );
}

/**
 * `SpaceShell` -- the three rows every space screen is built on, in every
 * phase, mode and game:
 *
 * 1. Space actions, the smallest and steadiest row: back, the space's
 *    name and one button for the space menu (the space's settings, then
 *    Leave for a guest or End for the host), which opens against that
 *    button; then the app's own status and account menu where no sidebar
 *    shows them. It never grows, never scrolls and never takes a game's
 *    controls. Under it, only while there is one, the space's `notice`.
 * 2. People (`people`), one fixed height on every screen, centered, and
 *    scrolling sideways when more people are present than fit.
 * 3. The stage (`children`), filling the rest and scrolling on its own.
 *
 * Hairlines separate the rows, which share the canvas. A space screen
 * starts from this shell and designs only its stage.
 *
 * @example
 * ```tsx
 * <SpaceShell spaceName="bob's space" role="guest" onBack={back}
 *   menu={settings} onLeave={leave} onEnd={end} notice={<Notice />}
 *   people={<SpacePeople people={people} viewer="guest" phase="choosing"
 *     onPersonAction={act} />}>
 *   <SpaceLauncher ... />
 * </SpaceShell>
 * ```
 */
export function SpaceShell(props: SpaceShellProps): JSX.Element {
  return (
    <div
      class={styles['shell']}
      {...dataAttrs({ component: 'SpaceShell', ...props.dataSet })}
      data-role={props.role}
    >
      <ActionsRow {...props} />
      <div class={styles['notice']} data-space-row="notice">
        {props.notice}
      </div>
      <div class={styles['people']} data-space-row="people">
        {props.people}
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
