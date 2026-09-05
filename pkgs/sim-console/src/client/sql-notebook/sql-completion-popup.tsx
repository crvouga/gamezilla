import { Badge, Box, Pressable, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import type { CompletionCandidate, CompletionResult } from './sql-completion';

export function SqlCompletionPopup(props: {
  readonly result: CompletionResult;
  readonly selectedIndex: number;
  readonly onSelect: (label: string) => void;
  readonly onHover: (index: number) => void;
}): ReactNode {
  const { result, selectedIndex, onSelect, onHover } = props;
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
      {result.candidates.map((c, i) => (
        <CompletionRow
          key={`${c.kind}:${c.label}`}
          candidate={c}
          selected={i === selectedIndex}
          onPress={() => onSelect(c.label)}
          onHover={() => onHover(i)}
        />
      ))}
    </Box>
  );
}

function CompletionRow(props: {
  readonly candidate: CompletionCandidate;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly onHover: () => void;
}): ReactNode {
  const { candidate, selected, onPress, onHover } = props;
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHover}
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
    </Pressable>
  );
}
