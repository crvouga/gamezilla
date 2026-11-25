/** @jsxImportSource @solidjs/web */
import { useClock } from '@pkgs/clock-client-ts/solid';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { pushEscapeDismissHandler } from '@pkgs/ui-root-shared-ts/escape-dismiss-stack';
import type {
  MarkdownEditorCommand,
  MarkdownEditorProps,
} from '@pkgs/ui-root-shared-ts/markdown-editor-types';
import { defaultMarkdownParser, schema } from 'prosemirror-markdown';
import type { Command, Selection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import {
  createEffect,
  createSignal,
  createUniqueId,
  onSettled,
  Show,
  untrack,
} from 'solid-js';
import { EditorLinkForm } from '../editor-link-form/index';
import { suggestionKeyHandler } from '../editor-suggestion-key';
import { EditorSuggestionMenu } from '../editor-suggestion-menu/index';
import type { EditorSuggestion } from '../editor-suggestions';
import { applyEditorSuggestion, editorSuggestion } from '../editor-suggestions';
import { EditorToolbar } from '../editor-toolbar/index';
import { createMarkdownView, DocumentField } from '../editor-view';
import { cleanMarkdownNode } from '../safe-markdown';
import styles from './markdown-editor.module.css';

function documentChange(view: EditorView, value: string) {
  return view.state.tr.replaceWith(
    0,
    view.state.doc.content.size,
    cleanMarkdownNode(defaultMarkdownParser.parse(value)).content
  );
}

/** External updates stay outside the local undo history. */
function replaceDocument(view: EditorView, value: string): void {
  view.updateState(
    view.state.apply(documentChange(view, value).setMeta('addToHistory', false))
  );
}

/** Points the field at the open suggestion list and its selected row. */
function describeSuggestions(
  field: Element,
  listId: string,
  selected: number | null
): void {
  field.setAttribute('aria-autocomplete', 'list');
  if (selected === null) {
    field.removeAttribute('aria-activedescendant');
    field.removeAttribute('aria-controls');
    return;
  }
  field.setAttribute('aria-controls', listId);
  field.setAttribute('aria-activedescendant', `${listId}-${selected}`);
}

type Suggestion = EditorSuggestion | null;

/** Names one suggestion, so a dismissed one stays dismissed. */
function marked(match: EditorSuggestion): string {
  return `${match.from}:${match.query}`;
}

function useEditor(props: MarkdownEditorProps) {
  const clock = useClock();
  const [view, setView] = createSignal<EditorView>();
  const [suggestion, setSuggestion] = createSignal<Suggestion>(null);
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
      dismissed = marked(match);
      setSuggestion(null);
    },
    submit: () => props.onSubmit?.(),
  });
  /** Builds the view in `host`; returns its teardown. */
  const mount = (host: HTMLElement): (() => void) => {
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
        setSuggestion(match && marked(match) !== dismissed ? match : null);
      },
    });
    current.dom.classList.add(styles['editor'] ?? '');
    setView(current);
    setSuggestion(editorSuggestion(current.state, props.commands ?? []));
    return () => current.destroy();
  };
  const sync = (
    current: EditorView,
    value: string,
    commands: readonly MarkdownEditorCommand[]
  ): void => {
    current.setProps({ editable: () => !props.disabled });
    if (value === lastValue) return;
    lastValue = value;
    replaceDocument(current, value);
    dismissed = '';
    setSuggestion(editorSuggestion(current.state, commands));
  };
  createEffect(
    () => ({
      current: view(),
      value: props.value,
      commands: props.commands ?? [],
      // What the view's own callbacks read when it is told to update.
      shown: [
        props.disabled,
        props.invalid,
        props.placeholder,
        props['aria-label'],
      ],
    }),
    ({ current, value, commands }) => {
      if (!current) return;
      // The view reads the props above through its callbacks as it updates.
      untrack(() => sync(current, value, commands));
    }
  );
  const dismiss = () => {
    const match = suggestion();
    if (match) dismissed = marked(match);
    setSuggestion(null);
  };
  return { view, suggestion, selected, choose, mount, dismiss };
}

function EditorDocument(props: {
  input: MarkdownEditorProps;
  editor: ReturnType<typeof useEditor>;
}) {
  let host: HTMLDivElement | undefined;
  onSettled(() => (host ? props.editor.mount(host) : undefined));
  return (
    <DocumentField
      value={props.input.value}
      disabled={props.input.disabled === true}
      aria-label={props.input['aria-label']}
      onValueChange={(value) => {
        const view = props.editor.view();
        if (view) view.dispatch(documentChange(view, value));
      }}
      ref={(element) => {
        host = element;
      }}
      class="box flex-1 min-h-0 shrink overflow-hidden text-sm leading-relaxed"
    />
  );
}

/**
 * Controlled Markdown writing surface with formatting, safe links and command suggestions. Inject a ClockProvider; changes emit Markdown while keyboard focus and selection stay in the editor. Supply aria-label to name the writing surface; invalid marks validation failures.
 */
export function MarkdownEditor(props: MarkdownEditorProps) {
  const editor = useEditor(props);
  const id = `editor-commands-${createUniqueId()}`;
  const [linkOpen, setLinkOpen] = createSignal(false);
  let savedSelection: Selection | undefined;
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
  createEffect(
    () => editor.suggestion() !== null,
    (suggesting) =>
      suggesting ? pushEscapeDismissHandler(editor.dismiss) : undefined
  );
  createEffect(
    () =>
      [
        editor.view()?.dom,
        editor.suggestion() !== null,
        editor.selected(),
      ] as const,
    ([field, suggesting, selected]) => {
      if (field) describeSuggestions(field, id, suggesting ? selected : null);
    }
  );
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
      <EditorDocument input={props} editor={editor} />
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
