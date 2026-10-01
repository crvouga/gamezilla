/** @jsxImportSource solid-js */
import { createMemo, For, Match, Switch } from 'solid-js';

/** Text nodes only: authored HTML is never interpreted as executable markup. */
export function MarkdownPreview(props: { value: string }) {
  const lines = createMemo(() => props.value.split('\n'));
  return <div class="box gap-2 break-words" data-component="FeedbackMarkdownPreview" data-testid="feedback-markdown-preview">
    <For each={lines()}>{line => <Switch fallback={<p class="text whitespace-pre-wrap text-sm leading-relaxed">{line || '\u00a0'}</p>}>
      <Match when={line.startsWith('### ')}><h4 class="text font-semibold">{line.slice(4)}</h4></Match>
      <Match when={line.startsWith('## ')}><h3 class="text font-semibold text-lg pt-2">{line.slice(3)}</h3></Match>
      <Match when={line.startsWith('# ')}><h2 class="text font-semibold text-xl pt-2">{line.slice(2)}</h2></Match>
      <Match when={/^[-*] /.test(line)}><p class="text text-sm pl-3">• {line.slice(2)}</p></Match>
      <Match when={line.startsWith('> ')}><blockquote class="text border-l-2 border-tint pl-3 text-sm">{line.slice(2)}</blockquote></Match>
    </Switch>}</For>
  </div>;
}
