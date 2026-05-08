import { useSpaceRoomState } from '@gamezilla/client/spaces/space-room-context';
import { useCurrentSpaceRole } from '@gamezilla/client/spaces/use-current-space-role';
import {
  SpaceGame,
  type SelectedSpaceGame,
} from '@gamezilla/domain/spaces/games/games';
import { Box, Button, Center, Pressable, Text } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { ChessArtwork } from './games/chess/chess-artwork';
import { ConnectFourArtwork } from './games/connect-four/connect-four-artwork';
import { GomokuArtwork } from './games/gomoku/gomoku-artwork';
import { TicTacToeArtwork } from './games/tic-tac-toe/tic-tac-toe-artwork';

function GameTile({
  title,
  status,
  children,
  disabled = false,
  selected = false,
  onPress,
}: {
  title: ReactNode;
  status?: ReactNode;
  disabled?: boolean;
  selected?: boolean;
  onPress?: () => void;
  children: ReactNode;
}) {
  const card = (
    <Box
      sx={{
        flexGrow: 1,
        flexBasis: 160,
        maxWidth: 260,
        minWidth: 140,
        borderRadius: 16,
        padding: 12,
        background: 'card',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: selected ? 'primary' : 'border',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Center sx={{ aspectRatio: 1, alignSelf: 'stretch' }}>
        <Box sx={{ width: 140 }}>{children}</Box>
      </Center>
      <Box sx={{ marginTop: 10 }}>
        <Text variant="heading">{title}</Text>
        {status ? (
          <Text sx={{ marginTop: 2, color: 'muted' }} variant="body">
            {status}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
  if (!onPress) return card;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button">
      {card}
    </Pressable>
  );
}

function GamesGrid({
  isHost,
  selectedGame,
  onSelectGame,
}: {
  isHost: boolean;
  selectedGame: SelectedSpaceGame;
  onSelectGame: (game: SelectedSpaceGame) => void;
}) {
  const chessProps = isHost
    ? { onPress: () => onSelectGame(SpaceGame.chess) }
    : {};

  return (
    <Box sx={{ alignSelf: 'stretch', gap: 3 }}>
      {!isHost ? (
        <Text
          variant="body"
          sx={{ color: 'textSecondary' }}
          label={<Trans>The host picks the game for this space.</Trans>}
        />
      ) : null}
      <Box
        sx={{
          alignSelf: 'stretch',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'stretch',
          justifyContent: 'flex-start',
        }}
      >
        <GameTile
          title={<Trans>Chess</Trans>}
          selected={selectedGame === SpaceGame.chess}
          {...chessProps}
        >
          <ChessArtwork size={128} />
        </GameTile>
        <GameTile
          title={<Trans>Tic-tac-toe</Trans>}
          status={<Trans>Coming soon</Trans>}
          disabled
        >
          <TicTacToeArtwork size={128} />
        </GameTile>
        <GameTile
          title={<Trans>Connect Four</Trans>}
          status={<Trans>Coming soon</Trans>}
          disabled
        >
          <ConnectFourArtwork size={128} />
        </GameTile>
        <GameTile
          title={<Trans>Gomoku</Trans>}
          status={<Trans>Coming soon</Trans>}
          disabled
        >
          <GomokuArtwork size={128} />
        </GameTile>
      </Box>
    </Box>
  );
}

function ChessMainMenu({
  isHost,
  onBack,
}: {
  isHost: boolean;
  onBack: () => void;
}) {
  const { t } = useLingui();
  return (
    <Box sx={{ alignSelf: 'stretch', gap: 3 }}>
      <Text variant="heading">
        <Trans>Chess main menu</Trans>
      </Text>
      <Text
        variant="body"
        sx={{ color: 'textSecondary' }}
        label={
          <Trans>
            Chess is selected for this space. Match setup options are coming
            next.
          </Trans>
        }
      />
      {isHost ? (
        <Button
          title={t`Pick a different game`}
          variant="outlined"
          onPress={onBack}
        />
      ) : null}
    </Box>
  );
}

export type SpaceGamePickerProps = {
  spaceId: string;
};

/** Game picker for a space. Reads shared room state via context. */
export function SpaceGamePicker({ spaceId }: SpaceGamePickerProps): ReactNode {
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const room = useSpaceRoomState();
  if (room === null) return null;
  const { selectedGame, selectGame } = room;
  if (selectedGame === SpaceGame.chess) {
    return <ChessMainMenu isHost={isHost} onBack={() => selectGame(null)} />;
  }
  return (
    <GamesGrid
      isHost={isHost}
      selectedGame={selectedGame}
      onSelectGame={selectGame}
    />
  );
}
