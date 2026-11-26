/** @jsxImportSource @solidjs/web */
/**
 * A person's or a thing's name inside a line of text, breakable at its
 * natural separators: a long username (`a_really_long_username`) wraps after
 * `_`, `.` or `-` before it would ever break mid-word. The breaks are
 * `<wbr>` elements, so the text a reader, a screen reader or a test reads is
 * the name exactly; the full name is also its `title`, for when the line
 * around it is clamped.
 *
 * It sets no type of its own: put it inside a `P`, `Text` or heading.
 *
 * @example
 * ```tsx
 * <P variant="caption" lines={2}><NameText name={person.name} /></P>
 * ```
 */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { createMemo, For, Show } from 'solid-js';

export type NameTextProps = {
  /** The name, shown in full. */
  readonly name: string;
};

/** One run of a name, and whether the line may break after it. */
export type NameRun = { readonly text: string; readonly breakAfter: boolean };

/** The name in runs that each end after a separator (`_`, `.`, `-`). */
export function nameBreakRuns(name: string): readonly NameRun[] {
  const runs = name.match(/[^_.-]*[_.-]+|[^_.-]+$/g) ?? [name];
  return runs.map((text, index) => ({
    text,
    breakAfter: index < runs.length - 1,
  }));
}

/** A name that wraps after `_`, `.` or `-` before breaking mid-word. */
export function NameText(props: NameTextProps): JSX.Element {
  const runs = createMemo(() => nameBreakRuns(props.name));
  return (
    <span title={props.name} data-component={componentId('NameText')}>
      <For keyed={false} each={runs()}>
        {(run) => (
          <>
            {run().text}
            <Show when={run().breakAfter}>
              <wbr />
            </Show>
          </>
        )}
      </For>
    </span>
  );
}
