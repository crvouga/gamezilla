import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import {
  type Segment,
  SegmentedControl,
} from '@pkgs/ui-root-client-ts/segmented-control';
import type { JSX } from '@solidjs/web';
import { createContext, Show, useContext } from 'solid-js';

export const GameSetupModeContext = createContext<{
  readonly segments: readonly Segment[];
  readonly selected: string;
  readonly onSelect: ((game: string) => void) | undefined;
} | null>(null);

/** A host selects the rules before opening a table or starting a search. */
export function GameSetupMode(props: { disabled?: boolean }): JSX.Element {
  const mode = useContext(GameSetupModeContext);
  const { t } = useLingui();
  return (
    <Show when={mode !== null && mode.segments.length > 1 ? mode : undefined}>
      {(choice) => (
        <SegmentedControl
          aria-label={t`Mode`}
          segments={choice().segments}
          selected={choice().selected}
          disabled={props.disabled === true || choice().onSelect === undefined}
          onSelect={(id) => choice().onSelect?.(id)}
          dataSet={{ testid: Handles.gameModes }}
        />
      )}
    </Show>
  );
}
