/** @jsxImportSource solid-js */
import { createMemo, For, Match, Show, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  feedbackMarkdownBlocks,
  type MarkdownBlock,
  safeMarkdownHref,
} from './markdown-blocks';

function InlineMarkdown(props: { text: string }) {
  const tokens = createMemo(() =>
    props.text
      .split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g)
      .filter(Boolean)
  );
  return (
    <For each={tokens()}>
      {(text) => {
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(text);
        const href = link?.[2] ? safeMarkdownHref(link[2]) : undefined;
        return (
          <Switch fallback={text}>
            <Match when={text.startsWith('**') && text.endsWith('**')}>
              <strong>{text.slice(2, -2)}</strong>
            </Match>
            <Match when={text.startsWith('`') && text.endsWith('`')}>
              <code class="rounded bg-tint-subtle px-1 font-mono text-sm">
                {text.slice(1, -1)}
              </code>
            </Match>
            <Match when={href}>
              <a
                class="text-tint underline"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link?.[1]}
              </a>
            </Match>
          </Switch>
        );
      }}
    </For>
  );
}
function MarkdownPiece(props: { block: MarkdownBlock }) {
  const heading = () =>
    props.block.type === 'heading'
      ? `h${Math.min(6, props.block.level + 1)}`
      : 'p';
  return (
    <Switch>
      <Match when={props.block.type === 'heading'}>
        <Dynamic component={heading()} class="text font-semibold text-lg pt-2">
          <InlineMarkdown
            text={'text' in props.block ? props.block.text : ''}
          />
        </Dynamic>
      </Match>
      <Match when={props.block.type === 'paragraph'}>
        <p class="text whitespace-pre-wrap text-sm leading-relaxed">
          <InlineMarkdown
            text={'text' in props.block ? props.block.text : ''}
          />
        </p>
      </Match>
      <Match when={props.block.type === 'quote'}>
        <blockquote class="text border-l-2 border-tint pl-3 text-sm">
          <InlineMarkdown
            text={'text' in props.block ? props.block.text : ''}
          />
        </blockquote>
      </Match>
      <Match when={props.block.type === 'code'}>
        <pre class="overflow-x-auto rounded-lg bg-tint-subtle p-3 text-sm">
          <code>{'text' in props.block ? props.block.text : ''}</code>
        </pre>
      </Match>
      <Match when={props.block.type === 'list'}>
        <Dynamic
          component={
            props.block.type === 'list' && props.block.ordered ? 'ol' : 'ul'
          }
          class="text text-sm pl-5 space-y-1"
          classList={{
            'list-decimal': props.block.type === 'list' && props.block.ordered,
            'list-disc': props.block.type === 'list' && !props.block.ordered,
          }}
        >
          <For each={props.block.type === 'list' ? props.block.items : []}>
            {(item) => (
              <li>
                <InlineMarkdown text={item} />
              </li>
            )}
          </For>
        </Dynamic>
      </Match>
    </Switch>
  );
}
/** Authored HTML is always text; links accept only safe, explicit destinations. */
export function MarkdownPreview(props: { value: string }) {
  const blocks = createMemo(() => feedbackMarkdownBlocks(props.value));
  return (
    <div
      class="box gap-3 break-words"
      data-component="FeedbackMarkdownPreview"
      data-testid="feedback-markdown-preview"
    >
      <Show
        when={blocks().length}
        fallback={
          <p class="text textCaption">
            Your feedback preview will appear here.
          </p>
        }
      >
        <For each={blocks()}>{(block) => <MarkdownPiece block={block} />}</For>
      </Show>
    </div>
  );
}
