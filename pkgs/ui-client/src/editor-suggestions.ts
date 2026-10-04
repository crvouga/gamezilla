import { defaultMarkdownParser } from 'prosemirror-markdown';
import type { EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { MarkdownEditorCommand } from '@pkgs/ui-shared/markdown-editor-types';
import { cleanMarkdownNode } from './safe-markdown';

export type EditorSuggestion = {
  from: number;
  to: number;
  query: string;
  commands: readonly MarkdownEditorCommand[];
};

export function editorSuggestion(
  state: EditorState,
  commands: readonly MarkdownEditorCommand[]
): EditorSuggestion | null {
  const selection = state.selection;
  if (!selection.empty || selection.$from.parent.type.name !== 'paragraph')
    return null;
  const text = selection.$from.parent.textBetween(
    0,
    selection.$from.parentOffset
  );
  const match = /(?:^|\s)\/([a-z]*)$/i.exec(text);
  if (!match) return null;
  const query = (match[1] ?? '').toLowerCase();
  const matches = commands.filter((command) =>
    [command.id, command.label, ...(command.aliases ?? [])].some((name) =>
      name.toLowerCase().startsWith(query)
    )
  );
  if (!matches.length) return null;
  return {
    from: selection.from - query.length - 1,
    to: selection.to,
    query,
    commands: matches,
  };
}

export function applyEditorSuggestion(
  view: EditorView,
  suggestion: EditorSuggestion,
  command: MarkdownEditorCommand
) {
  const content = cleanMarkdownNode(defaultMarkdownParser.parse(command.body));
  const transaction = view.state.tr.replaceWith(
    suggestion.from,
    suggestion.to,
    content.content
  );
  view.dispatch(transaction.scrollIntoView());
  view.focus();
}
