import type { State } from '@gamezilla/peer-store/types';
import { useState } from 'react';
import { Box, Pressable, Stack, Text } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/theme';

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
        <Text
          variant="caption"
          style={{ color: theme.colors.textSecondary }}
          label={hasDiff ? '▸ state (differs)' : '▸ state'}
        />
      </Pressable>
    );
  }

  return (
    <Box>
      <Pressable onPress={() => setExpanded(false)}>
        <Text
          variant="caption"
          sx={{ mb: 1 }}
          style={{ color: theme.colors.textSecondary }}
          label="▾ state"
        />
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
              label={`${key}: ${cVal}`}
            />
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
              label={`${key}: ${cVal}`}
            />
            <Text
              variant="mono"
              style={{ fontSize: 11, color: theme.colors.warning + 'cc' }}
              label={`${key}: ${dVal}`}
            />
          </Box>
        );
      })}
    </Stack>
  );
}
