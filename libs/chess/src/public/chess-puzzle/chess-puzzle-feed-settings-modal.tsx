import { useMyId } from '@libs/auth/public/use-current-user';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import {
  Combobox,
  ModalBody,
  ModalButton,
  ModalFooter,
  NumberStepper,
  ResponsiveSurface,
  SegmentedControl,
} from '@pkgs/ui';
import { createEffect, createMemo, type JSX, Show } from 'solid-js';

import {
  type ChessPuzzleFeedConfig,
  type ChessPuzzleFeedHistoryFilter,
  type ChessPuzzleFeedMode,
  chessPuzzleFeedConfigFingerprint,
  clampPuzzleFeedAutoOffset,
  clampPuzzleFeedRating,
  PUZZLE_FEED_AUTO_OFFSET_MAX,
  PUZZLE_FEED_AUTO_OFFSET_MIN,
  PUZZLE_FEED_AUTO_OFFSET_STEP,
  PUZZLE_FEED_RATING_MAX,
  PUZZLE_FEED_RATING_MIN,
  resolveEffectivePuzzleRating,
} from '../chess-puzzle-feed-config';
import { formatChessPuzzleThemeLabel } from '../chess-puzzle-theme-label';
import {
  CHESS_PUZZLE_THEMES,
  type ChessPuzzleTheme,
  isChessPuzzleTheme,
} from '../chess-puzzle-themes';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import { useChessPuzzleFeedPoolStats } from './use-chess-puzzle-feed-pool-stats';
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
}): JSX.Element {
  const modeSegments: Array<{ key: ChessPuzzleFeedMode; label: string }> = [
    { key: 'auto', label: t`Auto` },
    { key: 'custom', label: t`Custom` },
  ];
  return (
    <div class="box gap-2">
      <label class="text textLabel">{t`Difficulty mode`}</label>
      <SegmentedControl
        segments={modeSegments}
        selected={props.config.mode}
        onSelect={props.onSelectMode}
        dataSet={{ testid: 'chess-puzzle-feed-mode' }}
      />
      <p class="text textCaption">
        {feedModeCaption(props.config.mode, props.profileCaption)}
      </p>
    </div>
  );
}

function PuzzleFeedHistorySection(props: {
  historyFilter: ChessPuzzleFeedHistoryFilter;
  onSelect: (filter: ChessPuzzleFeedHistoryFilter) => void;
}): JSX.Element {
  const segments: Array<{
    key: ChessPuzzleFeedHistoryFilter;
    label: string;
  }> = [
    { key: 'any', label: t`Any` },
    { key: 'neverSeen', label: t`Unseen` },
    { key: 'seen', label: t`Seen` },
    { key: 'failed', label: t`Failed` },
  ];
  return (
    <div class="box gap-2">
      <label class="text textLabel">{t`Play history`}</label>
      <SegmentedControl
        segments={segments}
        selected={props.historyFilter}
        onSelect={props.onSelect}
        dataSet={{ testid: 'chess-puzzle-feed-history' }}
      />
      <p class="text textCaption">{t`Filter by puzzles you have never seen, already seen, or failed.`}</p>
    </div>
  );
}

function PuzzleFeedThemesSection(props: {
  themes: readonly ChessPuzzleTheme[];
  onChange: (themes: ChessPuzzleTheme[]) => void;
}): JSX.Element {
  const options = CHESS_PUZZLE_THEMES.map((theme) => ({
    value: theme,
    label: formatChessPuzzleThemeLabel(theme),
    searchText: formatChessPuzzleThemeLabel(theme),
    dataSet: { testid: `chess-puzzle-feed-theme-${theme}` },
  }));
  return (
    <Combobox
      label={t`Themes`}
      selectionMode="multiple"
      options={options}
      value={[...props.themes]}
      onValueChange={(next) => {
        props.onChange(next.filter(isChessPuzzleTheme));
      }}
      placeholder={t`Any theme`}
      searchPlaceholder={t`Search themes…`}
      emptyMessage={t`No matching themes`}
      surfaceTitle={t`Themes`}
      triggerDataSet={{ testid: 'chess-puzzle-feed-theme-trigger' }}
    />
  );
}

/**
 * Mode-dependent rating control. Branches inside `<Show>` so flipping the
 * mode segment swaps the stepper live (a bare `if` would freeze the first
 * branch for the modal's lifetime).
 */
function PuzzleFeedRatingSection(props: {
  config: ChessPuzzleFeedConfig;
  targetRating: number;
  onChangeCustomRating: (rating: number) => void;
  onChangeAutoOffset: (offset: number) => void;
}): JSX.Element {
  return (
    <Show
      when={props.config.mode === 'auto'}
      fallback={
        <NumberStepper
          label={t`Target rating`}
          value={props.config.customRating}
          onChange={props.onChangeCustomRating}
          min={PUZZLE_FEED_RATING_MIN}
          max={PUZZLE_FEED_RATING_MAX}
          step={50}
          dataSet={{ testid: 'chess-puzzle-feed-custom-rating' }}
        />
      }
    >
      <div class="box gap-2">
        <NumberStepper
          label={t`Rating offset`}
          value={props.config.autoOffset}
          onChange={props.onChangeAutoOffset}
          min={PUZZLE_FEED_AUTO_OFFSET_MIN}
          max={PUZZLE_FEED_AUTO_OFFSET_MAX}
          step={PUZZLE_FEED_AUTO_OFFSET_STEP}
          dataSet={{ testid: 'chess-puzzle-feed-offset' }}
        />
        <p class="text textCaption" data-testid="chess-puzzle-feed-target">
          {<Trans>Target rating: {props.targetRating}</Trans>}
        </p>
      </div>
    </Show>
  );
}

export type ChessPuzzleFeedSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  onFeedConfigApplied?: () => void;
};

export function ChessPuzzleFeedSettingsModal(
  props: ChessPuzzleFeedSettingsModalProps
): JSX.Element {
  const myId = useMyId();
  const { profileRating } = useChessPuzzleProfileRatings(myId);
  const [config, setConfig] = useChessPuzzleFeedConfig();
  const pool = useChessPuzzleFeedPoolStats();
  const profileCaption = profileRating() > 0 ? String(profileRating()) : '—';
  const targetRating = createMemo(() =>
    resolveEffectivePuzzleRating({
      config: config(),
      profileRating: profileRating(),
    })
  );
  const openFingerprintRef: { current: string | null } = { current: null };

  createEffect(() => {
    const visible = props.visible;
    if (!visible) {
      openFingerprintRef.current = null;
      return;
    }
    if (openFingerprintRef.current === null) {
      openFingerprintRef.current = chessPuzzleFeedConfigFingerprint(config());
    }
  });

  const onSelectMode = (mode: ChessPuzzleFeedMode): void => {
    setConfig((prev) => ({ ...prev, mode }));
  };
  const onChangeCustomRating = (customRating: number): void => {
    setConfig((prev) => ({
      ...prev,
      customRating: clampPuzzleFeedRating(customRating),
    }));
  };
  const onChangeAutoOffset = (autoOffset: number): void => {
    setConfig((prev) => ({
      ...prev,
      autoOffset: clampPuzzleFeedAutoOffset(autoOffset),
    }));
  };
  const onSelectHistory = (
    historyFilter: ChessPuzzleFeedHistoryFilter
  ): void => {
    setConfig((prev) => ({ ...prev, historyFilter }));
  };
  const onChangeThemes = (themes: ChessPuzzleTheme[]): void => {
    setConfig((prev) => ({ ...prev, themes }));
  };

  const onDone = (): void => {
    const opened = openFingerprintRef.current;
    const current = chessPuzzleFeedConfigFingerprint(config());
    if (opened !== null && opened !== current) {
      props.onFeedConfigApplied?.();
    }
    props.onClose();
  };

  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={props.onClose}
      title={<Trans>Puzzle feed</Trans>}
      presentation="modal"
    >
      <ModalBody>
        <div class="box gap-4">
          <p class="text textCaption" data-testid="chess-puzzle-feed-pool">
            {
              <Trans>
                {pool.matched()} matching · {pool.total()} local puzzles
              </Trans>
            }
          </p>
          <div class="box gap-1">
            <label class="text textLabel">{t`Your rating`}</label>
            <p class="text textBodyBold">{profileCaption}</p>
          </div>
          <PuzzleFeedModeSection
            config={config()}
            profileCaption={profileCaption}
            onSelectMode={onSelectMode}
          />
          <PuzzleFeedRatingSection
            config={config()}
            targetRating={targetRating()}
            onChangeCustomRating={onChangeCustomRating}
            onChangeAutoOffset={onChangeAutoOffset}
          />
          <PuzzleFeedHistorySection
            historyFilter={config().historyFilter}
            onSelect={onSelectHistory}
          />
          <PuzzleFeedThemesSection
            themes={config().themes}
            onChange={onChangeThemes}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <ModalButton
          label={t`Done`}
          onClick={onDone}
          dataSet={{ testid: 'chess-puzzle-feed-done' }}
        />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
