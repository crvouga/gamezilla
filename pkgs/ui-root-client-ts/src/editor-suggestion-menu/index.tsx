/** @jsxImportSource solid-js */

import type { MarkdownEditorCommand } from '@pkgs/ui-root-shared-ts/markdown-editor-types';
import { type Accessor, For } from 'solid-js';
import type { EditorSuggestion } from '../editor-suggestions';

/**
 * Markdown command options controlled by the editor selection accessor. The editor retains keyboard focus and owns arrow-key navigation; pointer selection preserves its text selection.
 */
export function EditorSuggestionMenu(props: {
  id: string;
  suggestion: EditorSuggestion;
  selected: Accessor<number>;
  choose: (command: MarkdownEditorCommand) => void;
}) {
  return (
    <div
      class="box shrink-0 border-t border-border bg-surface-elevated max-h-48 overflow-y-auto overscroll-contain"
      role="listbox"
      aria-label="Writing commands"
      id={props.id}
      data-component="MarkdownEditorSuggestions"
    >
      <For each={props.suggestion.commands}>
        {(command, index) => (
          <button
            type="button"
            role="option"
            id={`${props.id}-${index()}`}
            aria-selected={props.selected() === index()}
            tabIndex={-1}
            class="clickable clickableTint flex-row items-center gap-3 px-3 py-2 text-left"
            classList={{ 'bg-tint-subtle': props.selected() === index() }}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => props.choose(command)}
          >
            <span class="text text-sm font-semibold">/{command.id}</span>
            <span class="text textCaption">{command.description}</span>
          </button>
        )}
      </For>
    </div>
  );
}
