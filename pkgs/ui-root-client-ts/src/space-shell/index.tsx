/** @jsxImportSource solid-js */

import { Trans, useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { BackIconButton } from '../back-icon-button/index';
import { Button } from '../button/index';
import { IconButton } from '../icon-button/index';
import { SettingsIcon } from '../icons';
import type { SpaceRole } from '../space-types';
import styles from './space-shell.module.css';

export type SpaceShellProps = {
  /** The space's name, in row 1. */
  spaceName: string;
  /** Who is looking: a guest gets Leave, the host End. */
  role: SpaceRole;
  onBack: () => void;
  onSettings: () => void;
  /** A guest leaves the space. */
  onLeave: () => void;
  /** The host ends the space for everyone. */
  onEnd: () => void;
  /** Row 2: the people row (`SpacePeopleRow`). */
  people: JSX.Element;
  /** Row 3: what the space is doing now. */
  children: JSX.Element;
  /**
   * `scroll` (default): the stage scrolls on its own when its content is
   * taller than the room left. `fixed`: the content owns the room (a board
   * over an action bar) and nothing scrolls.
   */
  stage?: 'scroll' | 'fixed' | undefined;
  dataSet?: ComponentDataSet | undefined;
};

function ExitAction(props: {
  role: SpaceRole;
  onLeave: () => void;
  onEnd: () => void;
}): JSX.Element {
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
          dataSet={{ action: 'leave' }}
        />
      }
    >
      <Button
        title={<Trans>End</Trans>}
        intent="danger"
        variant="ghost"
        size="sm"
        onClick={() => props.onEnd()}
        dataSet={{ action: 'end' }}
      />
    </Show>
  );
}

/**
 * `SpaceShell` -- the three rows every space screen is built on, in every
 * phase, mode and game:
 *
 * 1. Space actions, the smallest and steadiest row: back, the space's
 *    name, space settings, and Leave for a guest or End for the host. It
 *    never grows, never scrolls and never takes a game's controls.
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
 *   onSettings={settings} onLeave={leave} onEnd={end}
 *   people={<SpacePeopleRow people={people} phase="choosing" onPerson={open} />}>
 *   <SpaceLauncher ... />
 * </SpaceShell>
 * ```
 */
export function SpaceShell(props: SpaceShellProps): JSX.Element {
  const { t } = useLingui();
  return (
    <div
      class={styles['shell']}
      {...dataAttrs({ component: 'SpaceShell', ...props.dataSet })}
      data-role={props.role}
    >
      <header class={styles['actions']} data-space-row="actions">
        <BackIconButton
          label={t`Back to spaces`}
          size={44}
          onClick={() => props.onBack()}
        />
        <div class={styles['where']}>
          <span class={`text textCaption ${styles['eyebrow']}`}>
            <Trans>Spaces</Trans>
          </span>
          <h1 class="text textHeading truncate min-w-0">{props.spaceName}</h1>
        </div>
        <IconButton
          label={t`Space settings`}
          aria-label={t`Space settings`}
          size={44}
          onClick={() => props.onSettings()}
          dataSet={{ action: 'settings' }}
        >
          <SettingsIcon size={24} color="icon" />
        </IconButton>
        <ExitAction
          role={props.role}
          onLeave={props.onLeave}
          onEnd={props.onEnd}
        />
      </header>
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
