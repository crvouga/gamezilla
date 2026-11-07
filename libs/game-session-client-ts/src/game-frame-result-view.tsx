import { t } from '@lingui/core/macro';
import {
  GameResultHeadline,
  type GameStandingRow,
  GameStandings,
} from '@pkgs/ui-root-client-ts/game-result';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, type JSX } from 'solid-js';
import { FrameHolderAvatar } from './game-frame-people';
import type { FramePeople, FrameResult } from './game-frame-view-types';

const STANDING_AVATAR_SIZE = 32;

/**
 * Final standings below the board or in its rail: every player in finishing
 * order, their score and whether they are ready for a rematch.
 */
export function FrameResultView(props: {
  readonly result: FrameResult;
  readonly people?: FramePeople | undefined;
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
      <GameStandings
        aria-label={t`Standings`}
        scoreLabel={props.result.scoreLabel}
        rows={rows()}
      />
    </StackVertical>
  );
}

/** The outcome and reason lead the completed board; standings stay in the rail. */
export function FrameResultHeadlineView(props: {
  readonly result: FrameResult;
}): JSX.Element {
  return (
    <GameResultHeadline
      title={props.result.headline}
      caption={props.result.note ?? undefined}
      dataSet={{ testid: 'custom-game-result-headline' }}
    />
  );
}
