/** @jsxImportSource solid-js */

import { redo, undo } from 'prosemirror-history';
import type { Command } from 'prosemirror-state';
import { For } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { editorFormats } from '../editor-commands';
import { IconButton } from '../icon-button/index';
import {
  BoldIcon,
  CodeIcon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PilcrowIcon,
  QuoteIcon,
  RedoIcon,
  UndoIcon,
} from '../icons';

const formatIcons = [
  BoldIcon,
  ItalicIcon,
  Heading2Icon,
  PilcrowIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  CodeIcon,
];

/**
 * Markdown formatting and history actions. The editor supplies commands and availability; disabled actions cannot modify the document.
 */
export function EditorToolbar(props: {
  disabled: boolean;
  run: (command: Command) => void;
  saveSelection: () => void;
  link: () => void;
}) {
  return (
    <div
      class="box flex-row shrink-0 items-center border-y border-border px-1 overflow-x-auto"
      role="group"
      aria-label="Text formatting"
      data-component="MarkdownEditorToolbar"
      onPointerDown={() => props.saveSelection()}
    >
      <For each={editorFormats}>
        {(format, index) => (
          <IconButton
            label={format.label}
            size={28}
            disabled={props.disabled}
            tooltip="default"
            tooltipFloating
            tooltipPlacement="top"
            dataSet={{ testid: `editor-${format.id}` }}
            onClick={() => props.run(format.command)}
          >
            <Dynamic component={formatIcons[index()] ?? CodeIcon} size={16} />
          </IconButton>
        )}
      </For>
      <IconButton
        label="Insert link"
        size={28}
        disabled={props.disabled}
        tooltip="default"
        tooltipFloating
        tooltipPlacement="top"
        onClick={props.link}
      >
        <LinkIcon size={16} />
      </IconButton>
      <IconButton
        label="Undo (⌘/Ctrl+Z)"
        size={28}
        disabled={props.disabled}
        tooltip="default"
        tooltipFloating
        tooltipPlacement="top"
        onClick={() => props.run(undo)}
      >
        <UndoIcon size={16} />
      </IconButton>
      <IconButton
        label="Redo (⌘/Ctrl+Shift+Z)"
        size={28}
        disabled={props.disabled}
        tooltip="default"
        tooltipFloating
        tooltipPlacement="top"
        onClick={() => props.run(redo)}
      >
        <RedoIcon size={16} />
      </IconButton>
    </div>
  );
}
