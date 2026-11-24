/**
 * Solid bindings for Lingui: the provider, the `<Trans>` runtime and the
 * `useLingui` hook that the macros in `./macro` compile to
 * (`runtimeConfigModule` in `lingui.solid.config.ts`).
 */

import type { I18n, MessageOptions } from '@lingui/core';
import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  type Component,
  createComponent,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type ParentProps,
  Show,
  useContext,
} from 'solid-js';

export type I18nContext = {
  /** The active instance; re-read by every subscriber when the locale or catalog changes. */
  i18n: Accessor<I18n>;
  _: I18n['_'];
};

export type I18nProviderProps = ParentProps<{ i18n: I18n }>;

export type TransProps = {
  id: string;
  message?: string;
  values?: Record<string, unknown>;
  components?: Record<string, Component<{ children?: JSX.Element }>>;
  formats?: MessageOptions['formats'];
  comment?: string;
};

export const LinguiContext = createContext<I18nContext>();

export function useLingui(): I18nContext {
  return useContext(LinguiContext);
}

/**
 * Provides `props.i18n` to the subtree and re-renders every translation when
 * it reports a change. Renders nothing until a locale is active.
 */
export function I18nProvider(props: I18nProviderProps): JSX.Element {
  const [changes, setChanges] = createSignal(0);
  let renderedLocale: string | undefined;
  const i18n = createMemo(
    () => {
      changes();
      renderedLocale = props.i18n.locale;
      return props.i18n;
    },
    { equals: false }
  );
  createEffect(
    () => props.i18n,
    (instance) => {
      const unsubscribe = instance.on('change', () => {
        setChanges((count) => count + 1);
      });
      // A locale activated between the first render and this subscription.
      if (instance.locale !== renderedLocale) setChanges((count) => count + 1);
      return unsubscribe;
    }
  );
  const context: I18nContext = {
    i18n,
    _: ((...args: Parameters<I18n['_']>) =>
      i18n()._(...args)) as I18n['_'],
  };
  return (
    <Show when={i18n().locale}>
      <LinguiContext value={context}>{props.children}</LinguiContext>
    </Show>
  );
}

const TAG =
  /<([a-zA-Z0-9_](?:[\w.-]*\w)?)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9_](?:[\w.-]*\w)?)\/>/;

type Components = NonNullable<TransProps['components']>;

/** `Hello <0>world</0>` → text and the declared components, in order. */
function formatElements(value: string, components: Components): JSX.Element {
  const parts = value.split(TAG);
  if (parts.length === 1) return value;
  const tree: JSX.Element[] = [];
  const before = parts.shift();
  if (before) tree.push(before);
  for (let index = 0; index < parts.length; index += 4) {
    const name = parts[index] ?? parts[index + 2];
    const inner = parts[index + 1];
    const after = parts[index + 3];
    const element = name === undefined ? undefined : components[name];
    const children = inner ? formatElements(inner, components) : undefined;
    if (element) tree.push(createComponent(element, { children }));
    else if (children !== undefined) tree.push(children);
    if (after) tree.push(after);
  }
  return tree.length === 1 ? tree[0] : tree;
}

/** Element values become indexed components so the message stays a string. */
function interpolation(props: TransProps): {
  values: Record<string, unknown> | undefined;
  components: Components;
} {
  const components: Components = { ...props.components };
  if (!props.values) return { values: undefined, components };
  const values: Record<string, unknown> = { ...props.values };
  for (const [key, value] of Object.entries(props.values)) {
    if (typeof value === 'string' || typeof value === 'number') continue;
    if (value == null || typeof value === 'boolean') {
      values[key] = '';
      continue;
    }
    const index = Object.keys(components).length;
    components[index] = () => value as JSX.Element;
    values[key] = `<${index}/>`;
  }
  return { values, components };
}

export function Trans(props: TransProps): JSX.Element {
  const lingui = useLingui();
  const translation = createMemo(() => {
    const { values, components } = interpolation(props);
    const options: MessageOptions = {};
    if (props.message !== undefined) options.message = props.message;
    if (props.formats !== undefined) options.formats = props.formats;
    const text = lingui.i18n()._(props.id, values, options);
    return text ? formatElements(text, components) : null;
  });
  return <>{translation()}</>;
}
