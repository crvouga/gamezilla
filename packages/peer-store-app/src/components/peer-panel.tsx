import type { Event, State } from '@gamezilla/peer-store/types';
import {
  Badge,
  Box,
  Button,
  Card,
  Collapsible,
  Stack,
  StatusDot,
  Text,
} from '@gamezilla/shared/ui';
import { StateInspector } from './state-inspector';
import { TicTacToeBoard } from './tic-tac-toe-board';

export type PeerAction = {
  label: string;
  color?: 'destructive' | 'warning' | 'success' | 'tint';
  active?: boolean;
  onPress: () => void;
};

export function PeerPanel({
  peerId,
  role,
  displayState,
  committedState,
  events,
  isOnline,
  isBadActor,
  isCheater,
  player,
  actions,
  onCellClick,
  onDisconnect,
  onReconnect,
}: {
  peerId: string;
  role: string;
  displayState: State;
  committedState: State;
  events: Event[];
  isOnline: boolean;
  isBadActor: boolean;
  isCheater: boolean;
  player: 'X' | 'O' | null;
  actions?: PeerAction[];
  onCellClick?: ((cell: number) => void) | undefined;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const isReadonly = player === null;
  const hasOptimistic =
    JSON.stringify(displayState) !== JSON.stringify(committedState);
  const hasBadges = isCheater || isBadActor;

  return (
    <Card elevation={1} sx={{ p: 4, gap: 3, flex: 1 }}>
      <Stack spacing={1}>
        <Stack direction="horizontal" align="center" justify="space-between">
          <Stack direction="horizontal" spacing={2} align="center">
            <Text variant="subtitle" numberOfLines={1} label={role} />
            <StatusDot status={isOnline ? 'online' : 'offline'} />
          </Stack>
          <Button
            title={isOnline ? 'Disconnect' : 'Reconnect'}
            variant="outlined"
            size="sm"
            color={isOnline ? 'destructive' : 'success'}
            onPress={isOnline ? onDisconnect : onReconnect}
          />
        </Stack>
        {hasBadges && (
          <Stack direction="horizontal" spacing={2}>
            {isCheater && <Badge label="CHEATER" color="warning" size="sm" />}
            {isBadActor && (
              <Badge label="BAD ACTOR" color="destructive" size="sm" />
            )}
          </Stack>
        )}
      </Stack>

      <TicTacToeBoard
        state={displayState}
        onCellClick={onCellClick}
        readonly={isReadonly}
      />

      <Stack direction="horizontal" spacing={3} align="center">
        <Stack direction="horizontal" spacing={1} align="center">
          <StatusDot status="online" size={8} />
          <Text variant="caption" label="committed" />
        </Stack>
        {hasOptimistic && (
          <Stack direction="horizontal" spacing={1} align="center">
            <StatusDot status="warning" size={8} />
            <Text variant="caption" label="optimistic" />
          </Stack>
        )}
      </Stack>

      <Box sx={{ minHeight: 28 }}>
        {actions && actions.length > 0 ? (
          <Stack direction="horizontal" spacing={2} wrap>
            {actions.map((action) => (
              <Button
                key={action.label}
                title={action.label}
                variant={action.active ? 'solid' : 'outlined'}
                size="sm"
                color={action.color ?? 'tint'}
                onPress={action.onPress}
              />
            ))}
          </Stack>
        ) : null}
      </Box>

      <Text variant="caption" label={peerId} />

      <StateInspector
        committedState={committedState}
        displayState={displayState}
      />

      <Collapsible title={`Events (${events.length})`}>
        {events.length === 0 && <Text variant="caption" label="none" />}
        {events.slice(-6).map((e, i) => (
          <Text key={i} variant="caption" label={e.type} />
        ))}
      </Collapsible>
    </Card>
  );
}
