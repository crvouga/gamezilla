/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Button as SdkButton } from '@ui-sdk/solid/button';
import { createSignal, onSettled, Show } from 'solid-js';
import { ChevronDownIcon, XIcon } from '../icons';
import { createScreenSlot } from '../screen-slot';
import styles from './game-stage-overlay.module.css';
import card from './result-card.module.css';

/** What a result says, on the board's card or beside the board. */
export type GameResultCardProps = {
  /** How the game went for this person; `neutral` for someone watching. */
  tone: 'won' | 'lost' | 'drawn' | 'neutral';
  /** Over the headline, in capitals: `Victory`, `Defeat`, `Draw`. */
  eyebrow?: JSX.Element | undefined;
  /** The result in a sentence (`You won`). */
  title: JSX.Element;
  /** Why (`Four in a row`), under it. */
  caption?: JSX.Element | undefined;
  /** The standings, a rating change. */
  children?: JSX.Element | undefined;
  /**
   * Names the details (`Standings`). Given, a small board's card folds
   * them behind a control of that name instead of leaving them out, so
   * the board stays in view and the details are one press away.
   */
  detailsLabel?: string | undefined;
  /** The card's own commands; the first is the way back to the board. */
  actions?: JSX.Element | undefined;
  /**
   * The headline and its caption are the screen's live announcement: a
   * listener hears them when the card appears and when they change.
   */
  live?: boolean | undefined;
  /** The headline's `data-*` (its test id). */
  titleDataSet?: ComponentDataSet | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export type GameResultOverlayProps = GameResultCardProps & {
  /** Names the close control (`Show the board`). */
  dismissLabel: string;
  onDismiss: () => void;
};

function ResultDetails(props: {
  label: string | undefined;
  children: JSX.Element;
}): JSX.Element {
  const [open, setOpen] = createSignal(false);
  let body: HTMLDivElement | undefined;
  // Opened, the person's own row (else the first) is brought into view
  // inside a card that scrolls, so their answer is never cut off.
  const reveal = (): void => {
    const own =
      body?.querySelector<HTMLElement>('[data-you="true"]') ??
      body?.querySelector<HTMLElement>('li, [role="listitem"]');
    own?.scrollIntoView({ block: 'nearest' });
  };
  return (
    <div
      class={card['details']}
      data-folds={String(props.label !== undefined)}
      data-open={String(open())}
    >
      <Show when={props.label}>
        {(label) => (
          <SdkButton
            type="button"
            class={`text textLabel ${card['detailsToggle']}`}
            aria-expanded={open() ? 'true' : 'false'}
            onClick={() => {
              const next = !open();
              setOpen(next);
              if (next) queueMicrotask(reveal);
            }}
            data-testid="game-result-overlay-details"
          >
            <span>{label()}</span>
            <ChevronDownIcon size={16} color="textSecondary" />
          </SdkButton>
        )}
      </Show>
      <div ref={body} class={card['detailsBody']}>
        {props.children}
      </div>
    </div>
  );
}

function ResultCard(
  props: GameResultCardProps & {
    docked: boolean;
    dismiss?: JSX.Element | undefined;
  }
): JSX.Element {
  const actions = createScreenSlot(() => props.actions);
  const details = createScreenSlot(() => props.children);
  return (
    <section
      class={`${styles['card']} ${card['quiet']} ${props.docked ? card['docked'] : ''}`}
      data-tone={props.tone}
      data-docked={String(props.docked)}
      {...dataAttrs(
        props.docked
          ? { component: 'GameResultCard', ...props.dataSet }
          : undefined
      )}
    >
      <div class={styles['cardHead']}>
        <div
          class={styles['cardTitle']}
          role={props.live === true ? 'status' : undefined}
          aria-live={props.live === true ? 'polite' : undefined}
          aria-atomic={props.live === true ? 'true' : undefined}
        >
          <Show when={props.eyebrow}>
            <span class={`text textCaption ${styles['eyebrow']}`}>
              {props.eyebrow}
            </span>
          </Show>
          <h2 class="text textTitle" {...dataAttrs({ ...props.titleDataSet })}>
            {props.title}
          </h2>
          <Show when={props.caption}>
            <p class="text textBody text-text-secondary">{props.caption}</p>
          </Show>
        </div>
        {props.dismiss}
      </div>
      <Show when={details.present()}>
        <ResultDetails label={props.detailsLabel}>
          {details.content()}
        </ResultDetails>
      </Show>
      <Show when={actions.present()}>
        <div
          class={`box flex-row flex-wrap gap-2 min-w-0 ${card['cardActions']}`}
        >
          {actions.content()}
        </div>
      </Show>
    </section>
  );
}

/**
 * `GameResultCard` -- how the game ended, beside the final board rather
 * than over it: a word for the result, the headline, why, the standings
 * (folded behind `detailsLabel` when given) and what to do next. The whole
 * final position stays in view, so nothing needs closing.
 *
 * @example
 * ```tsx
 * <GameResultCard tone="won" eyebrow="Victory" title="You won"
 *   caption="Four in a row" detailsLabel="Standings" live>
 *   <GameStandings rows={rows} aria-label="Standings" />
 * </GameResultCard>
 * ```
 */
export function GameResultCard(props: GameResultCardProps): JSX.Element {
  return <ResultCard {...props} docked />;
}

/**
 * `GameResultOverlay` -- how the game ended, on a card over the final
 * board: a word for the result, the headline, why, the standings and what
 * to do next. It never moves the board. Its close control (the words
 * `dismissLabel`, beside the result's word) and a press on
 * the dimmed board behind it both dismiss it; what it said stays reachable
 * from the screen's own commands.
 *
 * @example
 * ```tsx
 * <GameResultOverlay tone="won" eyebrow="Victory" title="You won"
 *   caption="Four in a row" dismissLabel="Show the board" onDismiss={close}
 *   actions={<Button title="Rematch" variant="solid" onClick={rematch} />}>
 *   <GameStandings rows={rows} aria-label="Standings" />
 * </GameResultOverlay>
 * ```
 */
export function GameResultOverlay(props: GameResultOverlayProps): JSX.Element {
  return (
    <div
      class={styles['result']}
      {...dataAttrs({ component: 'GameResultOverlay', ...props.dataSet })}
    >
      <SdkButton
        type="button"
        class={styles['scrim']}
        tabindex={-1}
        aria-hidden="true"
        onClick={() => props.onDismiss()}
      />
      <ResultCard
        {...props}
        docked={false}
        dismiss={
          // Named in words, not only a cross: closing is how the final
          // board is seen, so the card says so.
          <SdkButton
            type="button"
            class={`text textCaption ${styles['dismiss']}`}
            onClick={() => props.onDismiss()}
            data-testid="game-result-overlay-dismiss"
          >
            <span class={styles['dismissWords']}>{props.dismissLabel}</span>
            <XIcon size={16} color="textSecondary" />
          </SdkButton>
        }
      />
    </div>
  );
}

/** The corner of the board an overlay lies over, so its dimming keeps the board's own shape. */
export function boardCornerUnder(overlay: HTMLElement): string | undefined {
  const board = overlay.previousElementSibling;
  const view = overlay.ownerDocument.defaultView;
  if (board === null || !view) return undefined;
  const corner = view.getComputedStyle(board).borderRadius;
  return corner === '' || Number.parseFloat(corner) === 0 ? undefined : corner;
}

/**
 * The frame of a stage overlay: fills the board it is over, with the
 * board's own corners. `GameBoardStage` places its `overlay` in one;
 * nothing else needs it.
 */
export function GameStageOverlayFrame(props: {
  children: JSX.Element;
}): JSX.Element {
  const [corner, setCorner] = createSignal<string>();
  let frame: HTMLDivElement | undefined;
  onSettled(() => {
    if (frame !== undefined) setCorner(boardCornerUnder(frame));
  });
  return (
    <div
      ref={frame}
      class={styles['overlay']}
      style={{ '--game-board-corner': corner() }}
      {...dataAttrs({ component: 'GameStageOverlay' })}
    >
      {props.children}
    </div>
  );
}
