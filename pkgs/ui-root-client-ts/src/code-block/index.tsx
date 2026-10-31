/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { spaced } from '../layout-classes';

export type CodeBlockProps = {
  /** The text, exactly as it should read. */
  children?: JSX.Element | undefined;
  /** Break long lines instead of scrolling sideways. */
  wrap?: boolean | undefined;
  /** Paint the muted well around the text. Default `true`. */
  framed?: boolean | undefined;
  'aria-label'?: string | undefined;
  id?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

function codeBlockClass(block: CodeBlockProps): string {
  return spaced([
    'text textMono select-text',
    block.wrap === true
      ? 'whitespace-pre-wrap break-words'
      : 'whitespace-pre overflow-x-auto',
    block.framed === false
      ? undefined
      : 'bg-surface-muted rounded-control p-ui-md',
  ]);
}

/**
 * `CodeBlock` -- preformatted text in the mono face (was a raw `<pre>`): a
 * JSON snapshot, a stack trace, a command. Whitespace and line breaks are
 * kept exactly; the text can always be selected.
 *
 * Long lines scroll sideways by default. `wrap` breaks them instead, for
 * prose-like output (an error message) in a narrow column. `framed={false}`
 * drops the muted well when the block already sits on a surface.
 *
 * An identifier inside a sentence is the inline `Code` (`./text`).
 *
 * @example
 * ```tsx
 * <CodeBlock aria-label={t`Snapshot`}>{JSON.stringify(snapshot(), null, 2)}</CodeBlock>
 * <CodeBlock wrap framed={false}>{error().message}</CodeBlock>
 * ```
 */
export function CodeBlock(props: CodeBlockProps): JSX.Element {
  return (
    <pre
      class={codeBlockClass(props)}
      tabIndex={props.wrap === true ? undefined : 0}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('CodeBlock')}
      aria-label={props['aria-label']}
    >
      {props.children}
    </pre>
  );
}
