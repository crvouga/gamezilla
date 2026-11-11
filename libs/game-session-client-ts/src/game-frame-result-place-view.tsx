import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameResultHeadline } from '@pkgs/ui-root-client-ts/game-result';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import { FrameMovesCard } from './game-frame-moves-view';
import { FrameFacts, FrameStage } from './game-frame-play-view';
import { FrameResultView } from './game-frame-result-view';
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
          title={<Trans>Review moves</Trans>}
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
          title={<Trans>History and stats</Trans>}
          variant="ghost"
          intent="neutral"
          onClick={() => props.onOpenHistory()}
          dataSet={{ testid: 'custom-game-history-stats' }}
        />
      </Show>
    </GameActionBar>
  );
}

/**
 * Under the headline: how the game ended (`Black wins by resignation.`),
 * unless the headline already is that line, then the game's own note.
 */
function outcomeCaption(props: Props): string | undefined {
  const reason = props.result === null ? '' : (props.status?.description ?? '');
  const note = props.result?.note ?? '';
  const caption = [reason, note].filter((part) => part !== '').join(' ');
  return caption === '' ? undefined : caption;
}

/**
 * The result place, once the game is over or called off: what happened in
 * one headline, what to do next, the final position with the people around
 * it, every player's finish, and the moves that led there.
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
        outcome={
          <StackVertical gap="sm" testId="custom-game-outcome">
            <GameResultHeadline
              title={
                props.result?.headline ??
                props.status?.description ??
                t`Game finished`
              }
              caption={outcomeCaption(props)}
              dataSet={{ testid: 'custom-game-result-headline' }}
            />
            {/* The headline's caption says how the game ended; a listener
                hears it from the frame's own line. */}
            <FrameStatusView status={props.status} spokenOnly />
            <NextActions {...props} />
          </StackVertical>
        }
        aside={<FrameMovesCard {...props} listOnly />}
        status={
          <Show when={props.result}>
            {(result) => (
              <FrameResultView result={result()} people={props.people} />
            )}
          </Show>
        }
      >
        <FrameStage {...props} />
      </GameSessionLayout>
    </GameScreen>
  );
}
