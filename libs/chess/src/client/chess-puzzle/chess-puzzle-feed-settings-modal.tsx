import { useMyId } from '@libs/auth/client/use-current-user';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  Box,
  ModalBody,
  ModalButton,
  ModalFooter,
  NumberStepper,
  ResponsiveSurface,
  SegmentedControl,
  Text,
} from '@pkgs/ui';
import { type ReactNode, useCallback, useMemo } from 'react';
import {
  type ChessPuzzleFeedConfig,
  type ChessPuzzleFeedMode,
  clampPuzzleFeedAutoOffset,
  clampPuzzleFeedRating,
  PUZZLE_FEED_AUTO_OFFSET_MAX,
  PUZZLE_FEED_AUTO_OFFSET_MIN,
  PUZZLE_FEED_AUTO_OFFSET_STEP,
  PUZZLE_FEED_RATING_MAX,
  PUZZLE_FEED_RATING_MIN,
  resolveEffectivePuzzleRating,
} from '../../shared/chess-puzzle-feed-config';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';

function feedModeCaption(
  mode: ChessPuzzleFeedMode,
  profileCaption: string
): string {
  if (mode === 'auto') {
    return t`Match puzzles to your profile rating (${profileCaption}), plus an optional offset.`;
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

export type ChessPuzzleFeedSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ChessPuzzleFeedSettingsModal({
  visible,
  onClose,
}: ChessPuzzleFeedSettingsModalProps): ReactNode {
  const myId = useMyId();
  const { profileRating } = useChessPuzzleProfileRatings(myId);
  const [config, setConfig] = useChessPuzzleFeedConfig();
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
  const onChangeAutoOffset = useCallback(
    (autoOffset: number) => {
      setConfig((prev) => ({
        ...prev,
        autoOffset: clampPuzzleFeedAutoOffset(autoOffset),
      }));
    },
    [setConfig]
  );
  const profileCaption = profileRating > 0 ? String(profileRating) : '—';
  const targetRating = resolveEffectivePuzzleRating({ config, profileRating });

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onClose}
      title={<Trans>Puzzle feed</Trans>}
      presentation="modal"
    >
      <ModalBody>
        <Box sx={{ gap: 4 }}>
          <Text
            variant="caption"
            label={
              <Trans>
                Choose which puzzle ratings sync and get served next.
              </Trans>
            }
          />
          <Box sx={{ gap: 1 }}>
            <Text variant="label" label={t`Your rating`} />
            <Text variant="bodyBold" label={profileCaption} />
          </Box>
          <PuzzleFeedModeSection
            config={config}
            profileCaption={profileCaption}
            onSelectMode={onSelectMode}
          />
          {config.mode === 'auto' ? (
            <Box sx={{ gap: 2 }}>
              <NumberStepper
                label={t`Rating offset`}
                value={config.autoOffset}
                onChange={onChangeAutoOffset}
                min={PUZZLE_FEED_AUTO_OFFSET_MIN}
                max={PUZZLE_FEED_AUTO_OFFSET_MAX}
                step={PUZZLE_FEED_AUTO_OFFSET_STEP}
              />
              <Text
                variant="caption"
                label={<Trans>Target rating: {targetRating}</Trans>}
              />
            </Box>
          ) : (
            <NumberStepper
              label={t`Target rating`}
              value={config.customRating}
              onChange={onChangeCustomRating}
              min={PUZZLE_FEED_RATING_MIN}
              max={PUZZLE_FEED_RATING_MAX}
              step={50}
            />
          )}
        </Box>
      </ModalBody>
      <ModalFooter>
        <ModalButton label={t`Done`} onPress={onClose} />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
