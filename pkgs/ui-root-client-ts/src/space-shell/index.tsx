/** @jsxImportSource solid-js */

import { Trans, useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createSignal, type JSX, Show } from 'solid-js';
import { BackIconButton } from '../back-icon-button/index';
import { Button } from '../button/index';
import { IconButton } from '../icon-button/index';
import { SettingsIcon } from '../icons';
import { spaceDataSet } from '../space-data-set';
import { SpaceMenuSheet } from '../space-menu-sheet/index';
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
  /** The gear that opens the space settings. */
  settings?: string | undefined;
  /** A guest's Leave. */
  leave?: string | undefined;
  /** The host's End. */
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
   * The gear's own handler. With `menu` the gear opens the space settings
   * sheet instead; with neither the gear is not shown.
   */
  onSettings?: (() => void) | undefined;
  /** The space settings sheet behind the gear: Share, Rename, Minimize. */
  menu?: readonly SpaceMenuItem[] | undefined;
  /** A guest leaves the space. */
  onLeave: () => void;
  /** The host ends the space for everyone. */
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
  /** Row 2: the people row (`SpacePeople`). */
  people: JSX.Element;
  /** Row 3: what the space is doing now. */
  children: JSX.Element;
  /**
   * `scroll` (default): the stage scrolls on its own when its content is
   * taller than the room left (choices, history, settings pages). `fixed`:
   * the content owns the room (a board over an action bar) and nothing
   * scrolls.
   */
  stage?: 'scroll' | 'fixed' | undefined;
  dataSet?: ComponentDataSet | undefined;
};

function ExitAction(props: SpaceShellProps): JSX.Element {
  return (
    <Show
      when={props.role === 'host'}
      fallback={
        <Button
          title={<Trans>Leave</Trans>}
          intent="neutral"
          variant="ghost"
          size="sm"
          onClick={() => props.onLeave()}
          dataSet={spaceDataSet({ action: 'leave' }, props.testIds?.leave)}
        />
      }
    >
      <Button
        title={<Trans>End</Trans>}
        intent="danger"
        variant="ghost"
        size="sm"
        onClick={() => props.onEnd()}
        dataSet={spaceDataSet({ action: 'end' }, props.testIds?.end)}
      />
    </Show>
  );
}

/** The gear: its own handler, or the space settings sheet. */
function SettingsAction(props: SpaceShellProps): JSX.Element {
  const { t } = useLingui();
  const [open, setOpen] = createSignal(false);
  const press = (): void => {
    if (props.menu === undefined) props.onSettings?.();
    else setOpen(true);
  };
  return (
    <Show when={props.menu !== undefined || props.onSettings !== undefined}>
      <IconButton
        label={t`Space settings`}
        aria-label={t`Space settings`}
        size={44}
        onClick={press}
        dataSet={spaceDataSet({ action: 'settings' }, props.testIds?.settings)}
      >
        <SettingsIcon size={24} color="icon" />
      </IconButton>
      <Show when={props.menu}>
        {(items) => (
          <SpaceMenuSheet
            open={open()}
            title={t`Space settings`}
            items={items()}
            onClose={() => setOpen(false)}
          />
        )}
      </Show>
    </Show>
  );
}

function ActionsRow(props: SpaceShellProps): JSX.Element {
  const { t } = useLingui();
  return (
    <header class={styles['actions']} data-space-row="actions">
      <BackIconButton
        label={props.backLabel ?? t`Back to spaces`}
        size={44}
        onClick={() => props.onBack()}
        dataSet={spaceDataSet({ action: 'back' }, props.testIds?.back)}
      />
      <div class={styles['where']}>
        <span class={`text textCaption ${styles['eyebrow']}`}>
          <Trans>Spaces</Trans>
        </span>
        <h1
          class="text textHeading truncate min-w-0"
          data-testid={props.testIds?.title}
        >
          {props.spaceName}
        </h1>
      </div>
      <SettingsAction {...props} />
      <ExitAction {...props} />
    </header>
  );
}

/**
 * `SpaceShell` -- the three rows every space screen is built on, in every
 * phase, mode and game:
 *
 * 1. Space actions, the smallest and steadiest row: back, the space's
 *    name, space settings, and Leave for a guest or End for the host. It
 *    never grows, never scrolls and never takes a game's controls. Under
 *    it, only while there is one, the space's `notice`.
 * 2. People (`people`), one fixed height on every screen, scrolling
 *    sideways when more people are present than fit.
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
