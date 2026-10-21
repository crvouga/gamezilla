import type { MarkdownEditorCommand } from '@pkgs/ui-root-shared-ts/markdown-editor-types';
import type { Accessor, Setter } from 'solid-js';
import type { EditorSuggestion } from './editor-suggestions';

export function suggestionKeyHandler(options: {
  suggestion: Accessor<EditorSuggestion | null>;
  selected: Accessor<number>;
  setSelected: Setter<number>;
  choose: (command: MarkdownEditorCommand) => void;
  dismiss: (match: EditorSuggestion) => void;
  submit: () => void;
}) {
  return (event: KeyboardEvent): boolean => {
    const match = options.suggestion();
    if (
      match &&
      ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key) &&
      !event.isComposing
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        options.dismiss(match);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp')
        options.setSelected(
          (index) =>
            (index +
              (event.key === 'ArrowDown' ? 1 : -1) +
              match.commands.length) %
            match.commands.length
        );
      else {
        const command = match.commands[options.selected()];
        if (command) options.choose(command);
      }
      return true;
    }
    if (
      event.key === 'Enter' &&
      (event.metaKey || event.ctrlKey) &&
      !event.isComposing
    ) {
      options.submit();
      return true;
    }
    return false;
  };
}
