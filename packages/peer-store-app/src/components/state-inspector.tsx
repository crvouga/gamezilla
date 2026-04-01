import type { State } from '@gamezilla/peer-store/types';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { Box, Stack, Text } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui';

export function StateInspector({
  committedState,
  displayState,
}: {
  committedState: State;
  displayState: State;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = JSON.stringify(committedState) !== JSON.stringify(displayState);
  const theme = useTheme();

  if (!expanded) {
    return (
      <Pressable onPress={() => setExpanded(true)}>
        <Text variant="caption" style={{ color: theme.colors.textSecondary }}>
          {hasDiff ? '▸ state (differs)' : '▸ state'}
        </Text>
      </Pressable>
    );
  }

  return (
    <Box>
      <Pressable onPress={() => setExpanded(false)}>
        <Text variant="caption" sx={{ mb: 1 }} style={{ color: theme.colors.textSecondary }}>
          ▾ state
        </Text>
      </Pressable>
      <DiffView committed={committedState} display={displayState} />
    </Box>
  );
}

function DiffView({
  committed,
  display,
}: {
  committed: State;
  display: State;
}) {
  const theme = useTheme();
  const allKeys = new Set([
    ...Object.keys(committed),
    ...Object.keys(display),
  ]);

  return (
    <Stack spacing={0.5}>
      {[...allKeys].map((key) => {
        const cVal = JSON.stringify(committed[key]);
        const dVal = JSON.stringify(display[key]);
        const isSame = cVal === dVal;

        if (isSame) {
          return (
            <Text
              key={key}
              variant="mono"
              style={{ fontSize: 11, color: theme.colors.success + '80' }}
            >
              {key}: {cVal}
            </Text>
          );
        }

        return (
          <Box key={key}>
            <Text
              variant="mono"
              style={{
                fontSize: 11,
                color: theme.colors.destructive + '99',
                textDecorationLine: 'line-through',
              }}
            >
              {key}: {cVal}
            </Text>
            <Text
              variant="mono"
              style={{ fontSize: 11, color: theme.colors.warning + 'cc' }}
            >
              {key}: {dVal}
            </Text>
          </Box>
        );
      })}
    </Stack>
  );
}
