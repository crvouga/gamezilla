/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { BackIconButton } from '../back-icon-button/index';
import { EmbeddedScreen } from '../embedded-screen/index';
import { IconButton } from '../icon-button/index';
import { SettingsIcon } from '../icons';
import { createScreenSlot } from '../screen-slot';
import styles from './editor-stage-screen.module.css';

/** One of the stage's header commands: its spoken name and what it does. */
export type EditorStageCommand = {
  /** Spoken and shown as the button's tooltip. */
  label: string;
  onPress: () => void;
  /** Shipped as `data-testid`. */
  testId: string;
};

export type EditorStageScreenProps = {
  /** Stable screen identifier rendered as `data-screen`. */
  screenId: string;
  /** The way back out of the stage, at the header's start. */
  back: EditorStageCommand;
  /** What is being edited, named once, between back and settings. */
  title: JSX.Element;
  /** Opens what is edited's settings, at the header's end. */
  settings?: EditorStageCommand | undefined;
  /**
   * What needs the person first (a failed save, a conflict), between the
   * header and the status line, each with its own way on.
   */
  notices?: JSX.Element | undefined;
  /** One quiet line right above the stage: where the work stands. */
  status: JSX.Element;
  /** The stage: the board or canvas being edited. */
  children: JSX.Element;
  /**
   * The editing commands (undo, redo), in a bar right under the stage,
   * spanning it: a row of commands, then any command's failure with its
   * retry. The bar keeps its place whatever the commands say, so the stage
   * above it never moves; a command that cannot run is disabled, never
   * removed.
   */
  commands?: JSX.Element | undefined;
  /** Names the group of editing commands. */
  commandsLabel: string;
  dataSet?: ComponentDataSet | undefined;
};

/** 40px, the header's icon-button size. */
const HEADER_BUTTON_SIZE = 40;
/** 24px glyph in the 40px disc, as the back control draws its own. */
const HEADER_ICON_SIZE = 24;

/** Back, the title, and settings: one row, the title taking what is left. */
function EditorStageHeader(props: EditorStageScreenProps): JSX.Element {
  return (
    <div
      class={styles['header']}
      {...dataAttrs({ component: 'EditorStageHeader' })}
    >
      <BackIconButton
        label={props.back.label}
        size={HEADER_BUTTON_SIZE}
        onClick={() => props.back.onPress()}
        dataSet={{ testid: props.back.testId }}
      />
      <h1 class={`text textNavigationTitle ${styles['title']}`}>
        {props.title}
      </h1>
      <Show when={props.settings}>
        {(settings) => (
          <IconButton
            label={settings().label}
            aria-label={settings().label}
            size={HEADER_BUTTON_SIZE}
            onClick={() => settings().onPress()}
            dataSet={{ testid: settings().testId }}
          >
            <SettingsIcon size={HEADER_ICON_SIZE} color="text" />
          </IconButton>
        )}
      </Show>
    </div>
  );
}

/**
 * `EditorStageScreen` -- an editor whose board is the screen, inside a
 * host's chrome.
 *
 * Top to bottom in one column: a header row (back, the title, settings),
 * what needs the person first, one quiet status line, the stage, and a
 * bar of editing commands right under it. Everything sits in the flow, so
 * nothing is ever pinned over the stage, and the status line and the bar
 * keep their places as their words change, so the stage between them
 * never moves. The column takes a board and its rail's width at most.
 *
 * @example
 * ```tsx
 * <EditorStageScreen
 *   screenId="level-editor"
 *   back={{ label: 'Back', onPress: back, testId: 'editor-back' }}
 *   title="Level 4"
 *   settings={{ label: 'Details', onPress: details, testId: 'editor-details' }}
 *   status="Saved"
 *   commandsLabel="Editing"
 *   commands={<StackHorizontal><Button title="Undo" /><Button title="Redo" /></StackHorizontal>}
 * >
 *   <Board />
 * </EditorStageScreen>
 * ```
 */
export function EditorStageScreen(props: EditorStageScreenProps): JSX.Element {
  const notices = createScreenSlot(() => props.notices);
  const commands = createScreenSlot(() => props.commands);
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      width="full"
      dataSet={{ ...props.dataSet, component: 'EditorStageScreen' }}
    >
      <div
        class={styles['column']}
        {...dataAttrs({ component: 'EditorStageColumn' })}
      >
        <EditorStageHeader {...props} />
        <Show when={notices.present()}>
          <div
            class={styles['notices']}
            {...dataAttrs({ component: 'EditorStageNotices' })}
          >
            {notices.content()}
          </div>
        </Show>
        <p
          class={`text textCaption ${styles['status']}`}
          {...dataAttrs({ component: 'EditorStageStatus' })}
        >
          {props.status}
        </p>
        <div
          class={styles['stage']}
          {...dataAttrs({ component: 'EditorStageCanvas' })}
        >
          {props.children}
        </div>
        <Show when={commands.present()}>
          <div
            role="group"
            aria-label={props.commandsLabel}
            class={styles['commands']}
            {...dataAttrs({ component: 'EditorStageCommands' })}
          >
            {commands.content()}
          </div>
        </Show>
      </div>
    </EmbeddedScreen>
  );
}
