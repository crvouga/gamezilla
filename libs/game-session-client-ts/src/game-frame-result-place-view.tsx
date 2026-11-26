import { t } from '@lingui/core/macro';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { FixedGameSession } from '@pkgs/ui-root-client-ts/game-session-layout';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import type { FramePlaceProps } from './custom-game-screen-view';
import { FrameFacts } from './custom-game-stage-view';
import { FrameMovesCard } from './game-frame-moves-view';
import { FrameOutcomeCard } from './game-frame-outcome-card';
import { FrameStage } from './game-frame-stage';
import {
  FrameConnectionNotice,
  FrameErrorView,
  FrameStatusView,
} from './game-frame-status-view';

type Props = FramePlaceProps;

/**
 * What comes next once the game is over. Someone who played (or may set up
 * the next game) is offered the rematch, the one filled command, and a new
 * game with other choices; a player who may not start one, and someone
 * watching, go back to the space. Anyone
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
        <Show
          when={props.next.canCreate}
          fallback={
            // A player who may not start the next game still has a way on:
            // the card says the host starts the rematch.
            <Button
              title={<Trans>Back to the space</Trans>}
              // The one way on for someone who may not start the rematch:
              // filled, as the watcher's is.
              variant="solid"
              onClick={() => props.onBack()}
              dataSet={{ testid: 'custom-game-back' }}
            />
          }
        >
          {/* A cancelled game had no result to replay: New game leads. */}
          <Show
            when={props.phase === 'cancelled'}
            fallback={
              <>
                <GameActionButton
                  // After a refusal the same button says it tries again.
                  title={
                    <Show
                      when={props.error !== ''}
                      fallback={<Trans>Rematch</Trans>}
                    >
                      <Trans>Retry rematch</Trans>
                    </Show>
                  }
                  variant="solid"
                  dataSet={{ testid: 'custom-game-rematch' }}
                  operation={() => props.onChoose({ operation: 'rematch' })}
                />
                <Button
                  title={<Trans>New game</Trans>}
                  variant="outline"
                  dataSet={{ testid: 'custom-game-new' }}
                  onClick={() => props.onOpen({ screen: 'home' })}
                />
              </>
            }
          >
            <Button
              title={<Trans>New game</Trans>}
              variant="solid"
              dataSet={{ testid: 'custom-game-new' }}
              onClick={() => props.onOpen({ screen: 'home' })}
            />
            <GameActionButton
              title={<Trans>Rematch</Trans>}
              dataSet={{ testid: 'custom-game-rematch' }}
              operation={() => props.onChoose({ operation: 'rematch' })}
            />
          </Show>
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
 * The result place, once the game is over or called off: the whole final
 * position with the people around it, and beside it (under it on a phone)
 * a card that says what happened and every player's finish
 * (`FrameOutcomeCard`), then what to do next in the bar.
 */
export function FrameResultPlace(
  props: Props & { readonly confirming: boolean }
): JSX.Element {
  return (
    <GameScreen
      screenId="custom-game-result"
      title={props.title}
      compactInset={props.table.compactInset}
      facts={<FrameFacts {...props} />}
    >
      <FixedGameSession
        dataSet={{
          component: 'CustomGameContent',
          testid: 'custom-game-content',
          phase: props.phase,
          place: props.place.screen,
        }}
        notices={
          // Said in the Game over dialog above Rematch while it is open, and
          // over the commands once it is closed: never a card of its own.
          <>
            <FrameConnectionNotice connection={props.connection} afterGame />
            <FrameErrorView text={props.error} line />
          </>
        }
        // The card says how the game ended over the stage's foot (heading
        // the rail beside a wide board), so the final board keeps the live
        // board's place; a listener hears it from the frame's own line.
        sheet={
          <Show when={!props.confirming}>
            <FrameOutcomeCard {...props} />
          </Show>
        }
        status={<FrameStatusView status={props.status} spokenOnly />}
        actions={<NextActions {...props} />}
        history={<FrameMovesCard {...props} />}
      >
        {(information) => <FrameStage {...props} information={information} />}
      </FixedGameSession>
    </GameScreen>
  );
}
