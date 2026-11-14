import { packProgress } from '@libs/game-puzzle-shared-ts/pack-progress';
import { createMemo, type JSX } from 'solid-js';
import { useContentLibraryState } from './content-library-context';
import { ContentPackOverviewView } from './content-pack-overview-view';
import { useContentPlay } from './use-content-play';

/** `ContentPackOverviewView` wired to the person's progress through the pack. */
export function ContentPackOverview(props: {
  revisionId: string;
  /** False once the pack is withdrawn: saved attempts still continue. */
  available: boolean;
}): JSX.Element {
  const data = useContentLibraryState();
  const play = useContentPlay();
  const progress = createMemo(() =>
    packProgress({
      content: data.content(),
      play: data.play(),
      packRevisionId: props.revisionId,
    })
  );
  const status = () => {
    const pack = progress();
    if (pack !== null && pack.items.length === pack.total) return 'ready';
    if (data.isFetching()) return 'loading';
    return pack === null ? 'missing' : 'ready';
  };
  return (
    <ContentPackOverviewView
      status={status()}
      puzzles={progress()?.items ?? []}
      completed={progress()?.completedCount ?? 0}
      total={progress()?.total ?? 0}
      next={progress()?.next ?? null}
      complete={progress()?.complete ?? false}
      starting={play.starting()}
      failure={play.failure()?.message ?? null}
      disabled={!props.available}
      onPlay={(revisionId) =>
        play.play({ revisionId, packRevisionId: props.revisionId })
      }
      onRetry={play.retry}
    />
  );
}
