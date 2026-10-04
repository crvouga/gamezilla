/** @jsxImportSource solid-js */
import { useClock } from '@pkgs/clock-client/solid';
import { defaultMarkdownParser, schema } from 'prosemirror-markdown';
import type { Command, Selection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import {
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { pushEscapeDismissHandler } from '@pkgs/ui-shared/escape-dismiss-stack';
import { EditorLinkForm } from './editor-link-form';
import { suggestionKeyHandler } from './editor-suggestion-key';
import { EditorSuggestionMenu } from './editor-suggestion-menu';
import { applyEditorSuggestion, editorSuggestion } from './editor-suggestions';
import type { EditorSuggestion } from './editor-suggestions';
import { EditorToolbar } from './editor-toolbar';
import { createMarkdownView } from './editor-view';
import styles from './markdown-editor.module.css';
import type {
  MarkdownEditorCommand,
  MarkdownEditorProps,
} from '@pkgs/ui-shared/markdown-editor-types';
import { cleanMarkdownNode } from './safe-markdown';

function useEditor(props: MarkdownEditorProps) {
  const clock = useClock();
  const [view, setView] = createSignal<EditorView>();
  const [suggestion, setSuggestion] = createSignal<EditorSuggestion | null>(
    null
  );
  const [selected, setSelected] = createSignal(0);
  let lastValue = '';
  let dismissed = '';
  const choose = (command: MarkdownEditorCommand) => {
    const current = view();
    const match = suggestion();
    if (!current || !match || props.disabled) return;
    applyEditorSuggestion(current, match, command);
    props.onCommand?.(command.id);
  };
  const key = suggestionKeyHandler({
    suggestion,
    choose,
    selected,
    setSelected,
    dismiss: (match) => {
      dismissed = `${match.from}:${match.query}`;
      setSuggestion(null);
    },
    submit: () => props.onSubmit?.(),
  });
  const mount = (host: HTMLElement) => {
    const current = createMarkdownView({
      host,
      props,
      key,
      now: () => clock.now(),
      changed: (next, value) => {
        if (value !== undefined) {
          lastValue = value;
          props.onChange(value);
        }
        const match = editorSuggestion(next.state, props.commands ?? []);
        if (match?.query !== suggestion()?.query) setSelected(0);
        setSuggestion(
          match && `${match.from}:${match.query}` !== dismissed ? match : null
        );
      },
    });
    current.dom.classList.add(styles['editor'] ?? '');
    setView(current);
    setSuggestion(editorSuggestion(current.state, props.commands ?? []));
    onCleanup(() => current.destroy());
  };
  createEffect(() => {
    const current = view();
    const value = props.value;
    if (!current) return;
    current.setProps({ editable: () => !props.disabled });
    if (value === lastValue) return;
    lastValue = value;
    current.updateState(
      current.state.apply(
        current.state.tr
          .replaceWith(
            0,
            current.state.doc.content.size,
            cleanMarkdownNode(defaultMarkdownParser.parse(value)).content
          )
          .setMeta('addToHistory', false)
      )
    );
    dismissed = '';
    setSuggestion(editorSuggestion(current.state, props.commands ?? []));
  });
  const dismiss = () => {
    const match = suggestion();
    if (match) dismissed = `${match.from}:${match.query}`;
    setSuggestion(null);
  };
  return { view, suggestion, selected, choose, mount, dismiss };
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const editor = useEditor(props);
  const id = `editor-commands-${createUniqueId()}`;
  const [linkOpen, setLinkOpen] = createSignal(false);
  let savedSelection: Selection | undefined;
  let host: HTMLDivElement | undefined;
  const saveSelection = () => {
    savedSelection = editor.view()?.state.selection;
  };
  const run = (command: Command) => {
    const view = editor.view();
    if (!view || props.disabled) return;
    if (savedSelection)
      view.dispatch(view.state.tr.setSelection(savedSelection));
    command(view.state, view.dispatch, view);
    view.focus();
    savedSelection = undefined;
  };
  onMount(() => {
    if (host) editor.mount(host);
  });
  createEffect(() => {
    if (editor.suggestion())
      onCleanup(pushEscapeDismissHandler(editor.dismiss));
  });
  createEffect(() => {
    const field = editor.view()?.dom;
    if (!field) return;
    field.setAttribute('aria-autocomplete', 'list');
    field.setAttribute('aria-expanded', String(editor.suggestion() !== null));
    if (editor.suggestion()) {
      field.setAttribute('aria-controls', id);
      field.setAttribute('aria-activedescendant', `${id}-${editor.selected()}`);
    } else {
      field.removeAttribute('aria-activedescendant');
      field.removeAttribute('aria-controls');
    }
  });
  return (
    <div
      class="box flex-1 min-h-0 shrink overflow-hidden"
      {...dataAttrs({ component: 'MarkdownEditor', ...props.dataSet })}
    >
      <EditorToolbar
        disabled={props.disabled ?? false}
        run={run}
        saveSelection={saveSelection}
        link={() => {
          setLinkOpen(true);
        }}
      />
      <Show when={linkOpen()}>
        <EditorLinkForm
          onCancel={() => {
            setLinkOpen(false);
            editor.view()?.focus();
          }}
          onSave={(href) => {
            run((state, dispatch) => {
              dispatch?.(
                state.tr.addMark(
                  state.selection.from,
                  state.selection.to,
                  schema.marks.link.create({ href })
                )
              );
              return true;
            });
            setLinkOpen(false);
          }}
        />
      </Show>
      <div
        ref={host}
        class="box flex-1 min-h-0 shrink overflow-hidden text-sm leading-relaxed"
      />
      <Show when={editor.suggestion()}>
        {(match) => (
          <EditorSuggestionMenu
            id={id}
            suggestion={match()}
            selected={editor.selected}
            choose={editor.choose}
          />
        )}
      </Show>
    </div>
  );
}
