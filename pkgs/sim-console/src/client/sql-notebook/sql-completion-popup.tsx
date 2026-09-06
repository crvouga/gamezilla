import { Badge, Box, Clickable, Text } from '@pkgs/ui';
import type { Accessor } from 'solid-js';
import { For, type JSX } from 'solid-js';

import type { CompletionCandidate, CompletionResult } from './sql-completion';

export function SqlCompletionPopup(props: {
  readonly result: CompletionResult;
  readonly selectedIndex: Accessor<number>;
  readonly onSelect: (label: string) => void;
  readonly onHover: (index: number) => void;
}): JSX.Element {
  return (
    <Box
      sx={{
        borderWidth: 1,
        borderColor: 'outline',
        borderRadius: 'md',
        background: 'surface',
        maxHeight: 180,
        overflow: 'hidden',
      }}
      dataSet={{ component: 'SqlCompletionPopup' }}
    >
      <For each={props.result.candidates}>
        {(candidate, index) => (
          <CompletionRow
            candidate={candidate}
            selected={props.selectedIndex() === index()}
            onPress={() => props.onSelect(candidate.label)}
            onHover={() => props.onHover(index())}
          />
        )}
      </For>
    </Box>
  );
}

function CompletionRow(props: {
  readonly candidate: CompletionCandidate;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly onHover: () => void;
}): JSX.Element {
  const { candidate, selected, onPress, onHover } = props;
  return (
    <Clickable
      onClick={onPress}
      onMouseEnter={onHover}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1,
        background: selected ? 'tintSubtle' : 'transparent',
      }}
    >
      <Text
        variant="mono"
        sx={{ flex: 1, fontSize: 12, color: 'text' }}
        label={candidate.label}
      />
      <Badge label={candidate.kind} intent="neutral" size="sm" />
    </Clickable>
  );
}
