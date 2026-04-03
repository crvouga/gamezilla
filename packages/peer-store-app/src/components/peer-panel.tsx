import type { Event, State } from '@gamezilla/peer-store/types';
import {
  Badge,
  Button,
  Card,
  Collapsible,
  Stack,
  StatusDot,
  Text,
} from '@gamezilla/shared/ui';
import { StateInspector } from './state-inspector';
import { TicTacToeBoard } from './tic-tac-toe-board';

export function PeerPanel({
  displayState,
  committedState,
  events,
  isOnline,
  isBadActor,
  player,
  onCellClick,
  onDisconnect,
  onReconnect,
}: {
  displayState: State;
  committedState: State;
  events: Event[];
  isOnline: boolean;
  isBadActor: boolean;
  player: 'X' | 'O' | null;
  onCellClick?: ((cell: number) => void) | undefined;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const isWorker = player === null;
  const hasOptimistic =
    JSON.stringify(displayState) !== JSON.stringify(committedState);

  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Stack direction="horizontal" align="center" justify="space-between">
        <Stack direction="horizontal" spacing={2} align="center">
          <Text variant="subtitle">
            {isWorker ? 'Worker' : `Player ${player}`}
          </Text>
          {isBadActor && (
            <Badge label="BAD ACTOR" color="destructive" size="sm" />
          )}
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

      <TicTacToeBoard
        state={displayState}
        onCellClick={onCellClick}
        readonly={isWorker}
      />

      <Stack direction="horizontal" spacing={3} align="center">
        <Stack direction="horizontal" spacing={1} align="center">
          <StatusDot status="online" size={8} />
          <Text variant="caption">committed</Text>
        </Stack>
        {hasOptimistic && (
          <Stack direction="horizontal" spacing={1} align="center">
            <StatusDot status="warning" size={8} />
            <Text variant="caption">optimistic</Text>
          </Stack>
        )}
      </Stack>

      <StateInspector
        committedState={committedState}
        displayState={displayState}
      />

      <Collapsible title={`Events (${events.length})`}>
        {events.length === 0 && (
          <Text variant="caption">none</Text>
        )}
        {events.slice(-6).map((e, i) => (
          <Text key={i} variant="caption">
            {e.type}
          </Text>
        ))}
      </Collapsible>
    </Card>
  );
}
