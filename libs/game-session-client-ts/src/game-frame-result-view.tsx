import { t } from '@lingui/core/macro';
import {
  GameResultHeadline,
  type GameStandingRow,
  GameStandings,
} from '@pkgs/ui-root-client-ts/game-result';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, type JSX, Show } from 'solid-js';
import { FrameHolderAvatar } from './game-frame-people';
import type { FramePeople, FrameResult } from './game-frame-view-types';

const STANDING_AVATAR_SIZE = 32;

/**
 * Game over, under the final board: the headline (the viewer's own finish
 * when they played, else who won), then every player in finishing order
 * with their score and whether they are ready for a rematch.
 */
export function FrameResultView(props: {
  readonly result: FrameResult;
  readonly people?: FramePeople | undefined;
  readonly headline?: 'included' | 'separate' | undefined;
}): JSX.Element {
  const rows = createMemo((): readonly GameStandingRow[] =>
    props.result.standings.map((standing) => ({
      id: standing.id,
      place: standing.place,
      name: standing.name,
      score: standing.score,
      you: standing.you,
      testId: standing.testId,
      avatar: (
        <FrameHolderAvatar
          holder={standing.holder}
          plainName={standing.name}
          size={STANDING_AVATAR_SIZE}
          people={props.people}
        />
      ),
      readiness:
        standing.readiness === null
          ? null
          : {
              label: <>{standing.readiness.label}</>,
              ready: standing.readiness.ready,
            },
    }))
  );
  return (
    <StackVertical gap="md" testId="custom-game-result">
      <Show when={props.headline !== 'separate'}>
        <GameResultHeadline
          title={props.result.headline}
          caption={props.result.note ?? undefined}
          dataSet={{ testid: 'custom-game-result-headline' }}
        />
      </Show>
      <GameStandings
        aria-label={t`Standings`}
        scoreLabel={props.result.scoreLabel}
        rows={rows()}
      />
    </StackVertical>
  );
}
