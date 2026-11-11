import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { ChevronUpIcon } from '@pkgs/ui-root-client-ts/icons';
import { type JSX, Show } from 'solid-js';
import { FrameMovesCard } from './game-frame-moves-view';
import { FrameFacts, FrameStage } from './game-frame-play-view';
import type { FramePlaceProps } from './game-frame-screen-view';
import { FrameNoticesView } from './game-frame-shell';
import { FrameStatusView } from './game-frame-status-view';

type Props = FramePlaceProps;

/**
 * What comes next once the game is over. Someone who played (or may set up
 * the next game) is offered the rematch, the one filled command, and a new
 * game with other choices; someone watching goes back to the space. Anyone
 * may step through the moves or open the space's history.
 */
function NextActions(props: Props): JSX.Element {
  return (
    <GameActionBar aria-label={t`What next`} items={[]} width="content">
      <Show
        when={props.next.plays}
        fallback={
          <Button
            title={<Trans>Back to the space</Trans>}
            variant="solid"
            onClick={() => props.onBack()}
            dataSet={{ testid: 'custom-game-back' }}
          />
        }
      >
        <Show when={props.next.canCreate}>
          <GameActionButton
            title={<Trans>Rematch</Trans>}
            variant="solid"
            dataSet={{ testid: 'custom-game-rematch' }}
            operation={() => props.onChoose({ operation: 'rematch' })}
          />
          <GameActionButton
            title={<Trans>New game</Trans>}
            dataSet={{ testid: 'custom-game-new' }}
            operation={() => props.onChoose({ operation: 'create' })}
          />
        </Show>
      </Show>
      <Show when={props.next.reviewable}>
        <Button
          title={<Trans>Review</Trans>}
          aria-label={t`Review moves`}
          variant="outline"
          intent="neutral"
          onClick={() => {
            props.onSeek(0);
            props.onOpen({ screen: 'moves' });
          }}
          dataSet={{ testid: 'custom-game-review-start' }}
        />
      </Show>
      <Show when={props.record?.history}>
        <Button
          title={<Trans>History</Trans>}
          aria-label={t`History and stats`}
          variant="outline"
          intent="neutral"
          onClick={() => props.onOpenHistory()}
          dataSet={{ testid: 'custom-game-history-stats' }}
        />
      </Show>
    </GameActionBar>
  );
}

/**
 * The result place, once the game is over or called off: the final
 * position with the people around it, under a card that says what happened
 * and every player's finish (`FrameOverlay`), and what to do next in the
 * bar. Closing the card shows the final board; Result brings it back.
 */
export function FrameResultPlace(props: Props): JSX.Element {
  return (
    <GameScreen
      screenId="custom-game-result"
      title={props.title}
      compactInset={props.table.compactInset}
      facts={<FrameFacts {...props} />}
    >
      <GameSessionLayout
        dataSet={{
          component: 'CustomGameContent',
          testid: 'custom-game-content',
          phase: props.phase,
          place: props.place.screen,
        }}
        notices={
          <FrameNoticesView connection={props.connection} error={props.error} />
        }
        boardFocus
        actionsBeside
        fixedStage
        status={
          <>
            {/* The card says how the game ended; a listener hears it from
                the frame's own line, with or without the card. */}
            <FrameStatusView status={props.status} spokenOnly />
            <Show when={props.overlay.kind === 'board'}>
              <Button
                title={
                  props.result?.headline ??
                  props.status?.description ??
                  t`Game finished`
                }
                aria-label={t`Show the result`}
                variant="ghost"
                intent="neutral"
                fullWidth
                endIcon={<ChevronUpIcon size={20} />}
                onClick={() => props.onOverlay({ type: 'show' })}
                dataSet={{ testid: 'custom-game-show-result' }}
              />
            </Show>
          </>
        }
        actions={<NextActions {...props} />}
        aside={<FrameMovesCard {...props} listOnly />}
      >
        <FrameStage {...props} />
      </GameSessionLayout>
    </GameScreen>
  );
}
