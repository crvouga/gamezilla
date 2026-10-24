import { Trans } from '@lingui/solid/macro';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { createMemo, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useContentGame } from './content-game-context';

export function ContentPreview(props: { definition: string }): JSX.Element {
  const game = useContentGame();
  const initial = createMemo(() => {
    const result = game.content.rules.initial(props.definition);
    return result.accepted ? { state: result.state } : null;
  });
  return (
    <Show
      when={game.client.Preview}
      keyed
      fallback={
        <Show
          when={initial()}
          fallback={
            <Notice>
              <Trans>
                Complete the required puzzle details before previewing or
                playtesting.
              </Trans>
            </Notice>
          }
        >
          {(result) => (
            <Dynamic
              component={game.client.Player}
              definition={props.definition}
              state={result().state}
              disabled
              onAction={() => undefined}
            />
          )}
        </Show>
      }
    >
      {(Preview) => <Preview definition={props.definition} />}
    </Show>
  );
}
