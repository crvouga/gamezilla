import { useMyId } from '@libs/auth-client/use-current-user';
import { formatChessPuzzleThemeLabel } from '@libs/chess-puzzle-shared/chess-puzzle-theme-label';
import type { ChessPuzzleTheme } from '@libs/chess-puzzle-shared/chess-puzzle-themes';
import {
  CHESS_PUZZLE_THEMES,
  chessPuzzleThemesOf,
  isChessPuzzleTheme,
} from '@libs/chess-puzzle-shared/chess-puzzle-themes';
import type {
  PuzzleAutoAdvance,
  PuzzleFeedConfig,
  PuzzleFeedHistoryFilter,
  PuzzleFeedMode,
} from '@libs/game-puzzle-shared/feed-config';
import {
  clampPuzzleFeedAutoOffset,
  clampPuzzleFeedRating,
  encodePuzzleFeedConfig,
  PUZZLE_FEED_AUTO_OFFSET_MAX,
  PUZZLE_FEED_AUTO_OFFSET_MIN,
  PUZZLE_FEED_AUTO_OFFSET_STEP,
  PUZZLE_FEED_RATING_MAX,
  PUZZLE_FEED_RATING_MIN,
  puzzleFeedConfigFingerprint,
  resolveEffectivePuzzleRating,
} from '@libs/game-puzzle-shared/feed-config';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Handles } from '@libs/test-ids-shared/handles';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Combobox } from '@pkgs/ui-root-client/combobox';
import {
  ModalBody,
  ModalButton,
  ModalFooter,
} from '@pkgs/ui-root-client/modal-parts';
import { NumberStepper } from '@pkgs/ui-root-client/number-stepper';
import { ResponsiveSurface } from '@pkgs/ui-root-client/responsive-surface';
import { SegmentedControl } from '@pkgs/ui-root-client/segmented-control';
import { createEffect, createMemo, type JSX, Show } from 'solid-js';
import { createFeedSettingsDraft } from './create-feed-settings-draft';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import { useChessPuzzleFeedPoolStats } from './use-chess-puzzle-feed-pool-stats';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';

function feedModeCaption(mode: PuzzleFeedMode, profileCaption: string): string {
  if (mode === 'auto') {
    return t`Match puzzles to your profile rating (${profileCaption}), plus an optional offset.`;
  }
  return t`Pick a fixed target rating for the puzzle feed.`;
}

function PuzzleFeedModeSection(props: {
  config: PuzzleFeedConfig;
  profileCaption: string;
  onSelectMode: (mode: PuzzleFeedMode) => void;
}): JSX.Element {
  const modeSegments: Array<{ key: PuzzleFeedMode; label: string }> = [
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
  historyFilter: PuzzleFeedHistoryFilter;
  onSelect: (filter: PuzzleFeedHistoryFilter) => void;
}): JSX.Element {
  const segments: Array<{
    key: PuzzleFeedHistoryFilter;
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

function PuzzleAutoAdvanceSection(props: {
  autoAdvance: PuzzleAutoAdvance;
  onSelect: (autoAdvance: PuzzleAutoAdvance) => void;
}): JSX.Element {
  const segments: Array<{ key: PuzzleAutoAdvance; label: string }> = [
    { key: 'off', label: t`Off` },
    { key: 'after1s', label: t`After 1 s` },
    { key: 'immediate', label: t`Immediately` },
  ];
  return (
    <div class="box gap-2">
      <label class="text textLabel">{t`Auto-advance`}</label>
      <SegmentedControl
        segments={segments}
        selected={props.autoAdvance}
        onSelect={props.onSelect}
        dataSet={{ testid: 'chess-puzzle-feed-auto-advance' }}
      />
      <p class="text textCaption">{t`Move on to the next puzzle by itself after a solve.`}</p>
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
      searchDataSet={{ testid: 'chess-puzzle-feed-theme-search' }}
      doneDataSet={{ testid: 'chess-puzzle-feed-theme-done' }}
    />
  );
}

/**
 * Mode-dependent rating control. Branches inside `<Show>` so flipping the
 * mode segment swaps the stepper live (a bare `if` would freeze the first
 * branch for the modal's lifetime).
 */
function PuzzleFeedRatingSection(props: {
  config: PuzzleFeedConfig;
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

type FeedConfigEditors = {
  onSelectMode: (mode: PuzzleFeedMode) => void;
  onChangeCustomRating: (rating: number) => void;
  onChangeAutoOffset: (offset: number) => void;
  onSelectHistory: (filter: PuzzleFeedHistoryFilter) => void;
  onChangeThemes: (themes: ChessPuzzleTheme[]) => void;
  onSelectAutoAdvance: (autoAdvance: PuzzleAutoAdvance) => void;
};

/** One edit per field, each a patch on the persisted feed config. */
function feedConfigEditors(
  setConfig: ReturnType<typeof useChessPuzzleFeedConfig>[1]
): FeedConfigEditors {
  return {
    onSelectMode: (mode) => setConfig((prev) => ({ ...prev, mode })),
    onChangeCustomRating: (customRating) =>
      setConfig((prev) => ({
        ...prev,
        customRating: clampPuzzleFeedRating(customRating),
      })),
    onChangeAutoOffset: (autoOffset) =>
      setConfig((prev) => ({
        ...prev,
        autoOffset: clampPuzzleFeedAutoOffset(autoOffset),
      })),
    onSelectHistory: (historyFilter) =>
      setConfig((prev) => ({ ...prev, historyFilter })),
    onChangeThemes: (themes) => setConfig((prev) => ({ ...prev, themes })),
    onSelectAutoAdvance: (autoAdvance) =>
      setConfig((prev) => ({ ...prev, autoAdvance })),
  };
}

function PuzzleFeedSections(props: {
  config: PuzzleFeedConfig;
  profileCaption: string;
  targetRating: number;
  editors: FeedConfigEditors;
}): JSX.Element {
  return (
    <>
      <PuzzleFeedModeSection
        config={props.config}
        profileCaption={props.profileCaption}
        onSelectMode={props.editors.onSelectMode}
      />
      <PuzzleFeedRatingSection
        config={props.config}
        targetRating={props.targetRating}
        onChangeCustomRating={props.editors.onChangeCustomRating}
        onChangeAutoOffset={props.editors.onChangeAutoOffset}
      />
      <PuzzleFeedHistorySection
        historyFilter={props.config.historyFilter}
        onSelect={props.editors.onSelectHistory}
      />
      <PuzzleFeedThemesSection
        themes={chessPuzzleThemesOf(props.config.themes)}
        onChange={props.editors.onChangeThemes}
      />
      <PuzzleAutoAdvanceSection
        autoAdvance={props.config.autoAdvance}
        onSelect={props.editors.onSelectAutoAdvance}
      />
    </>
  );
}

export function ChessPuzzleFeedSettingsModal(
  props: ChessPuzzleFeedSettingsModalProps
): JSX.Element {
  const myId = useMyId();
  const { profileRating } = useChessPuzzleProfileRatings(myId);
  const [saved, setSaved] = useChessPuzzleFeedConfig();
  const [config, setConfig] = createFeedSettingsDraft(
    saved,
    () => props.visible
  );
  // Customizing the feed is for accounts; a guest is invited to sign in.
  const customize = useDecision(PERMISSION.puzzlesCustomizeFeed);
  const pool = useChessPuzzleFeedPoolStats(config);
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
      openFingerprintRef.current = puzzleFeedConfigFingerprint(config());
    }
  });

  const editors = feedConfigEditors(setConfig);

  const onDone = (): void => {
    const opened = openFingerprintRef.current;
    const current = puzzleFeedConfigFingerprint(config());
    if (encodePuzzleFeedConfig(saved()) !== encodePuzzleFeedConfig(config()))
      setSaved(config());
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
        <Show
          when={customize().allowed}
          fallback={
            <DenialSurface
              decision={customize()}
              variant="compact"
              testId={Handles.chessPuzzleFeedLocked}
            />
          }
        >
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
            <PuzzleFeedSections
              config={config()}
              profileCaption={profileCaption}
              targetRating={targetRating()}
              editors={editors}
            />
          </div>
        </Show>
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
