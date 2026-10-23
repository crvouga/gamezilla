import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';

export function ContentSavedAttempts(props: {
  mode: 'ordinary' | 'playtest';
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const attempts = createMemo(() =>
    data.play().attempts.filter((attempt) => attempt.mode === props.mode)
  );
  return (
    <Show when={attempts().length > 0}>
      <MenuSection
        title={
          props.mode === 'ordinary' ? (
            <Trans>Your saved attempts</Trans>
          ) : (
            <Trans>Your private playtests</Trans>
          )
        }
      >
        <For each={attempts().map((attempt) => attempt.id)}>
          {(id) => {
            const attempt = () => attempts().find((entry) => entry.id === id);
            const source = () =>
              props.mode === 'ordinary'
                ? data
                    .content()
                    .revisions.find(
                      (entry) => entry.id === attempt()?.source_id
                    )
                : data
                    .content()
                    .drafts.find((entry) => entry.id === attempt()?.source_id);
            const done = () =>
              props.mode === 'ordinary' &&
              data
                .play()
                .completions.some(
                  (entry) => entry.puzzle_revision_id === attempt()?.source_id
                );
            return (
              <MenuRow
                title={(source()?.title ?? '') || t`Saved puzzle`}
                caption={
                  props.mode === 'ordinary'
                    ? t`Your progress is kept at this edition.`
                    : t`Private playtest. Personal and pack progress stay unchanged.`
                }
                trailing={
                  <Badge
                    label={
                      done()
                        ? t`Completed`
                        : props.mode === 'ordinary'
                          ? t`In progress`
                          : t`Playtest`
                    }
                    intent="neutral"
                  />
                }
                onClick={() => game.open({ kind: 'attempt', attemptId: id })}
                dataSet={{ testid: `content-attempt-${id}` }}
              />
            );
          }}
        </For>
      </MenuSection>
    </Show>
  );
}
