import {
  baseKeymap,
  chainCommands,
  exitCode,
  setBlockType,
  toggleMark,
  wrapIn,
} from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import {
  inputRules,
  textblockTypeInputRule,
  undoInputRule,
  wrappingInputRule,
} from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { schema } from 'prosemirror-markdown';
import {
  liftListItem,
  sinkListItem,
  splitListItem,
  wrapInList,
} from 'prosemirror-schema-list';
import type { Command } from 'prosemirror-state';

export const editorFormats: readonly {
  id: string;
  label: string;
  command: Command;
}[] = [
  {
    id: 'bold',
    label: 'Bold (⌘/Ctrl+B)',
    command: toggleMark(schema.marks.strong),
  },
  {
    id: 'italic',
    label: 'Italic (⌘/Ctrl+I)',
    command: toggleMark(schema.marks.em),
  },
  {
    id: 'heading',
    label: 'Heading',
    command: setBlockType(schema.nodes.heading, { level: 2 }),
  },
  {
    id: 'paragraph',
    label: 'Paragraph',
    command: setBlockType(schema.nodes.paragraph),
  },
  {
    id: 'bullet-list',
    label: 'Bullet list',
    command: wrapInList(schema.nodes.bullet_list),
  },
  {
    id: 'ordered-list',
    label: 'Numbered list',
    command: wrapInList(schema.nodes.ordered_list),
  },
  { id: 'quote', label: 'Quote', command: wrapIn(schema.nodes.blockquote) },
  { id: 'code', label: 'Code', command: toggleMark(schema.marks.code) },
];

export function editorPlugins() {
  return [
    history(),
    inputRules({
      rules: [
        textblockTypeInputRule(
          /^(#{1,6})\s$/,
          schema.nodes.heading,
          (match) => ({ level: match[1]?.length ?? 2 })
        ),
        textblockTypeInputRule(/^```\s$/, schema.nodes.code_block),
        wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
        wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
        wrappingInputRule(
          /^(\d+)\.\s$/,
          schema.nodes.ordered_list,
          (match) => ({ order: Number(match[1]) })
        ),
      ],
    }),
    keymap({
      'Mod-b': toggleMark(schema.marks.strong),
      'Mod-i': toggleMark(schema.marks.em),
      'Mod-`': toggleMark(schema.marks.code),
      'Mod-z': undo,
      'Mod-Shift-z': redo,
      'Mod-y': redo,
      Backspace: undoInputRule,
      Enter: splitListItem(schema.nodes.list_item),
      'Mod-Enter': chainCommands(exitCode),
      'Mod-[': liftListItem(schema.nodes.list_item),
      'Mod-]': sinkListItem(schema.nodes.list_item),
    }),
    keymap(baseKeymap),
  ];
}
