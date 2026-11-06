import type {
  NumberlinkDefinition,
  NumberlinkState,
} from '@libs/numberlink-shared-ts/numberlink-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { For } from 'solid-js';

/** Touch equivalents of the existing redraw, backtrack and Delete gestures. */
export function NumberlinkRecovery(props: {
  definition: NumberlinkDefinition;
  state: NumberlinkState;
  onAction: (action: string) => void;
}) {
  const { t } = useLingui();
  return (
    <StackVertical gap="sm">
      <P variant="caption" tone="secondary">
        <Trans>
          Start again at a number to redraw its path. Drag back along your path
          to shorten it. Remove a drawn path below to start fresh.
        </Trans>
      </P>
      <StackHorizontal gap="sm" wrap>
        <For
          each={props.definition.pairs.filter((pair) =>
            props.state.paths.some((path) => path.pairId === pair.id)
          )}
        >
          {(pair) => (
            <Button
              title={t`Remove path ${pair.label}`}
              intent="neutral"
              variant="outline"
              size="md"
              onClick={() =>
                props.onAction(JSON.stringify({ pairId: pair.id, cells: [] }))
              }
            />
          )}
        </For>
      </StackHorizontal>
    </StackVertical>
  );
}
