/** @jsxImportSource @solidjs/web */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { Badge } from '../badge';
import { Button } from '../button';
import { PlayIcon } from '../icons';
import { P } from '../text';
import { useLayoutMode } from '../use-layout-mode';

/** Where the offer sits: pinned above the tab bar, or within a screen. */
export type ReturnToGamePlacement = 'dock' | 'inline';

export type ReturnToGameProps = {
  /** What is waiting, in a few words ("Your custom game is under way"). */
  title: JSX.Element;
  /** The player pictured beside a daily match. */
  leading?: JSX.Element;
  /** Whose turn it is in a daily match. */
  turn?: JSX.Element;
  caption?: JSX.Element | undefined;
  /** The one command, named by where it leads ("Return to the custom game"). */
  action: JSX.Element;
  onReturn: () => void;
  /** `dock` (default) above the tab bar; `inline` in place of a command. */
  placement?: ReturnToGamePlacement | undefined;
  /** Rendered as `data-kind`: which game waits, for whoever reads the screen. */
  kind?: string | undefined;
  /** Rendered as `data-testid`; the command is `<testId>-go`. */
  testId?: string | undefined;
};

/**
 * `ReturnToGame` — the way back to a game the person left unfinished, one
 * step from wherever they are: what waits, and one command that goes there.
 *
 * - `dock`: a bar above the tab bar, like the miniplayer it sits beside:
 *   edge to edge on compact, its words over a full-width command, and on
 *   wide card-shaped, the command beside the words;
 * - `inline`: a card in a screen, in place of a command the unfinished
 *   game keeps the person from (such as seeking an opponent); its command
 *   runs the card's full width.
 *
 * @example
 * ```tsx
 * <ReturnToGame
 *   title={t`Your custom game is under way`}
 *   caption={t`Chess · Robin's space`}
 *   action={t`Return to the custom game`}
 *   onReturn={open}
 * />
 * ```
 */
export function ReturnToGame(props: ReturnToGameProps): JSX.Element {
  const mode = useLayoutMode();
  const inline = (): boolean => props.placement === 'inline';
  // A row only where the words keep their room beside the command.
  const row = (): boolean => !inline() && mode() === 'wide';
  const command = (): JSX.Element => (
    <Button
      title={props.action}
      onClick={() => props.onReturn()}
      startIcon={<PlayIcon size={16} />}
      intent="primary"
      variant="solid"
      size={row() ? 'sm' : inline() ? 'lg' : 'md'}
      fullWidth={!row()}
      dataSet={
        props.testId === undefined
          ? undefined
          : { testid: `${props.testId}-go` }
      }
    />
  );
  return (
    <div
      class={[
        'box w-full self-stretch bg-surface border border-border gap-ui-md p-ui-md',
        {
          'flex-row items-center min-h-18': row(),
          'flex-col items-stretch': !row(),
          'rounded-card': inline() || mode() === 'wide',
          'rounded-none': !inline() && mode() !== 'wide',
        },
      ]}
      role="region"
      aria-live="polite"
      data-testid={props.testId}
      data-kind={props.kind}
      data-placement={inline() ? 'inline' : 'dock'}
      data-layout={mode()}
      data-component={componentId('ReturnToGame')}
    >
      <div class="box flex-row items-center gap-ui-md grow shrink min-w-0">
        {props.leading}
        <div class="box flex-col grow shrink min-w-0">
          <Show when={props.turn}>
            {(turn) => <Badge size="sm" intent="neutral" label={turn()} />}
          </Show>
          <P variant="bodyBold" lines={2}>
            {props.title}
          </P>
          <Show when={props.caption}>
            {(caption) => (
              <P variant="caption" tone="secondary">
                {caption()}
              </P>
            )}
          </Show>
        </div>
      </div>
      {command()}
    </div>
  );
}
