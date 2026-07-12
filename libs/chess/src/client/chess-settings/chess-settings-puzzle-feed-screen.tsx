import { DefineBackButton } from '@libs/spaces/client/nav/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces/client/room/use-space-room-selector';
import { useMyId } from '@libs/auth/client/use-current-user';
import {
  Box,
  NumberStepper,
  ScrollView,
  SegmentedControl,
  Text,
  useTheme,
} from '@pkgs/ui';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useCallback, useMemo, type ReactNode } from 'react';

import {
  clampPuzzleFeedRating,
  PUZZLE_FEED_RATING_MAX,
  PUZZLE_FEED_RATING_MIN,
  type ChessPuzzleFeedConfig,
  type ChessPuzzleFeedMode,
} from '../../shared/chess-puzzle-feed-config';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '../../shared/chess-main-menu';
import { useChessPuzzleFeedConfig } from '../chess-puzzle/use-chess-puzzle-feed-config';
import { useChessPuzzleProfileRatings } from '../chess-puzzle/use-chess-puzzle-profile-ratings';

function feedModeCaption(
  mode: ChessPuzzleFeedMode,
  profileCaption: string
): string {
  if (mode === 'auto') {
    return t`Match puzzles to your profile rating (${profileCaption}).`;
  }
  return t`Pick a fixed target rating for the puzzle feed.`;
}

function PuzzleFeedModeSection(props: {
  config: ChessPuzzleFeedConfig;
  profileCaption: string;
  onSelectMode: (mode: ChessPuzzleFeedMode) => void;
}): ReactNode {
  const modeSegments = useMemo(
    (): Array<{ key: ChessPuzzleFeedMode; label: string }> => [
      { key: 'auto', label: t`Auto` },
      { key: 'custom', label: t`Custom` },
    ],
    []
  );
  return (
    <Box sx={{ gap: 2 }}>
      <Text variant="label" label={t`Difficulty mode`} />
      <SegmentedControl
        segments={modeSegments}
        selected={props.config.mode}
        onSelect={props.onSelectMode}
      />
      <Text
        variant="caption"
        label={feedModeCaption(props.config.mode, props.profileCaption)}
      />
    </Box>
  );
}

export function ChessSettingsPuzzleFeedScreen(): ReactNode {
  const theme = useTheme();
  const dispatch = useSpaceRoomDispatch();
  const myId = useMyId();
  const { profileRating } = useChessPuzzleProfileRatings(myId);
  const [config, setConfig] = useChessPuzzleFeedConfig();
  const backToSettings = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.settings }));
  }, [dispatch]);
  const onSelectMode = useCallback(
    (mode: ChessPuzzleFeedMode) => {
      setConfig((prev) => ({ ...prev, mode }));
    },
    [setConfig]
  );
  const onChangeCustomRating = useCallback(
    (customRating: number) => {
      setConfig((prev) => ({
        ...prev,
        customRating: clampPuzzleFeedRating(customRating),
      }));
    },
    [setConfig]
  );
  const profileCaption = profileRating > 0 ? String(profileRating) : '—';

  return (
    <>
      <DefineBackButton onPress={backToSettings} />
      <ScrollView sx={{ flex: 1, alignSelf: 'stretch' }}>
        <Box sx={{ gap: 4, p: 4, pb: 8 }}>
          <Box sx={{ gap: 1 }}>
            <Text
              variant="title"
              style={{ color: theme.colors.text }}
              label={<Trans>Puzzle feed</Trans>}
            />
            <Text
              variant="caption"
              label={
                <Trans>
                  Choose which puzzle ratings sync and get served next.
                </Trans>
              }
            />
          </Box>
          <PuzzleFeedModeSection
            config={config}
            profileCaption={profileCaption}
            onSelectMode={onSelectMode}
          />
          {config.mode === 'custom' ? (
            <NumberStepper
              label={t`Target rating`}
              value={config.customRating}
              onChange={onChangeCustomRating}
              min={PUZZLE_FEED_RATING_MIN}
              max={PUZZLE_FEED_RATING_MAX}
              step={50}
            />
          ) : null}
        </Box>
      </ScrollView>
    </>
  );
}
