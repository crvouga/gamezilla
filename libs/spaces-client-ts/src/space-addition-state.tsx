import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import type { CreateAsyncResult } from '@pkgs/async-root-client-ts/solid';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import { type Accessor, type JSX, Show } from 'solid-js';

export function SpaceAdditionState(props: {
  readonly addition: CreateAsyncResult<string, [string, string]>;
  readonly lastPick: Accessor<{
    readonly id: string;
    readonly name: string;
  } | null>;
}): JSX.Element {
  const retry = (): void => {
    const pick = props.lastPick();
    if (pick !== null)
      void props.addition.run(pick.id, pick.name).catch(() => undefined);
  };
  return (
    <>
      <Show when={props.addition.status() === 'success'}>
        <SuccessState
          variant="compact"
          title={<Trans>{props.addition.value()} added</Trans>}
          body={
            <Trans>
              They can find this space in their lobby and choose Join.
            </Trans>
          }
          dataSet={{ testid: Handles.spaceAddSuccess }}
        />
      </Show>
      <Show when={props.addition.error()} keyed>
        {(error) => (
          <ErrorState
            variant="compact"
            title={<Trans>Couldn't add person</Trans>}
            body={error.message}
            retry={{ onClick: retry }}
          />
        )}
      </Show>
    </>
  );
}
