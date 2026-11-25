import { componentDataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { MarkdownEditorProps } from '@pkgs/ui-root-shared-ts/markdown-editor-types';
import { createChange, definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';
import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from 'prosemirror-markdown';
import { Fragment, type Node, Slice } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { editorPlugins } from './editor-commands';
import { cleanMarkdownNode } from './safe-markdown';

export function createMarkdownView(options: {
  host: HTMLElement;
  props: MarkdownEditorProps;
  changed: (view: EditorView, value?: string) => void;
  key: (event: KeyboardEvent) => boolean;
  now: () => number;
}) {
  const doc = cleanMarkdownNode(
    defaultMarkdownParser.parse(options.props.value)
  );
  const view = new EditorView(options.host, {
    state: EditorState.create({
      doc,
      selection: TextSelection.atEnd(doc),
      plugins: editorPlugins(),
    }),
    editable: () => !options.props.disabled,
    attributes: () => ({
      role: 'textbox',
      'aria-label': options.props['aria-label'],
      'aria-multiline': 'true',
      'aria-invalid': String(options.props.invalid ?? false),
      'aria-disabled': String(options.props.disabled ?? false),
      'data-placeholder': options.props.placeholder ?? '',
      ...componentDataAttrs('MarkdownEditorField', undefined),
    }),
    handleKeyDown: (_view, event) => options.key(event),
    transformPasted: (slice) => {
      const nodes: Node[] = [];
      slice.content.forEach((node) => nodes.push(cleanMarkdownNode(node)));
      return new Slice(Fragment.from(nodes), slice.openStart, slice.openEnd);
    },
    dispatchTransaction(transaction) {
      transaction.setTime(options.now());
      const next = view.state.apply(transaction);
      const value = transaction.docChanged
        ? defaultMarkdownSerializer.serialize(next.doc, { tightLists: true })
        : undefined;
      if (
        value !== undefined &&
        value.length > (options.props.maxLength ?? Infinity)
      )
        return;
      view.updateState(next);
      options.changed(view, value);
    },
  });
  return view;
}

type DocumentOptions = {
  value: string;
  disabled: boolean;
  onValueChange: (value: string) => void;
};

const documentField = definePrimitive({
  name: 'markdown-editor',
  options: { value: 'string', disabled: 'boolean', onValueChange: 'callback' },
  controlled: ['value'],
  state: (options: DocumentOptions) => ({
    value: options.value,
    disabled: options.disabled,
  }),
  sync: ({ value, disabled }) => ({ value, disabled }),
  api: (context) => {
    const change = createChange(context);
    return {
      setValue(value: unknown) {
        if (typeof value === 'string' && !context.options().disabled)
          change('value', value, { reason: 'imperative' });
      },
    };
  },
  agent: { actions: ['setValue'] },
  slots: (slot) => ({ root: slot({}) }),
});

export const { Root: DocumentField } = createParts(documentField, {
  root: 'div',
});
