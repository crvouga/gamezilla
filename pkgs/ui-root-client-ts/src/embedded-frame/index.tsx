/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';

export type EmbeddedFrameProps = {
  /** Accessible name of the embedded document or app. */
  title: string;
  /** Load this document in an `<iframe>`. Unset hosts `children` instead. */
  src?: string | undefined;
  /** The in-tree app, when there is no `src`. */
  children?: JSX.Element | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

/** The frame claims the room it is given and clips what it hosts. */
const FRAME = 'box flex-1 w-full h-full overflow-hidden';

/** The host app's scroll anchoring must not move the embedded app. */
const NO_ANCHOR: JSX.CSSProperties = { 'overflow-anchor': 'none' };

/**
 * `EmbeddedFrame` -- another app shown inside this one: a document loaded
 * from `src` (an `<iframe>`), or an app mounted in this tree (`children`).
 * It fills its parent, never pushes it wider or taller, clips its content,
 * and keeps the embedded app's scroll anchoring to itself.
 *
 * `title` is required: it names the frame for assistive technology (the
 * `<iframe title>`, or the region's label for an in-tree app).
 *
 * @example
 * ```tsx
 * <EmbeddedFrame title={t`Alice's phone`} src={alice.url} />
 * <EmbeddedFrame title={t`Bob's phone`}>
 *   <ProductApp embedded history={bob.history} />
 * </EmbeddedFrame>
 * ```
 */
export function EmbeddedFrame(props: EmbeddedFrameProps): JSX.Element {
  return (
    <Show
      when={props.src}
      fallback={
        <div
          class={FRAME}
          style={NO_ANCHOR}
          role="region"
          aria-label={props.title}
          data-testid={props.testId}
          data-component={componentId('EmbeddedFrame')}
        >
          {props.children}
        </div>
      }
    >
      {(src) => (
        <iframe
          class="box flex-1 w-full h-full border-0"
          title={props.title}
          src={src()}
          data-testid={props.testId}
          data-component={componentId('EmbeddedFrame')}
        />
      )}
    </Show>
  );
}
