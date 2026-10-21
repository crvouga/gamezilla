import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type {
  PuzzleAutoAdvance,
  PuzzleFeedConfig,
  PuzzleFeedHistoryFilter,
  PuzzleFeedMode,
} from '@libs/game-puzzle-shared-ts/feed-config';
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
} from '@libs/game-puzzle-shared-ts/feed-config';
import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Combobox } from '@pkgs/ui-root-client-ts/combobox';
import { FormField } from '@pkgs/ui-root-client-ts/form-field';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import {
  ModalBody,
  ModalButton,
  ModalFooter,
} from '@pkgs/ui-root-client-ts/modal-parts';
import { NumberStepper } from '@pkgs/ui-root-client-ts/number-stepper';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { SegmentedControl } from '@pkgs/ui-root-client-ts/segmented-control';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createEffect, createMemo, type JSX, Show } from 'solid-js';
import { createFeedSettingsDraft } from './create-feed-settings-draft';
import type { GamePuzzlesClient } from './puzzle-client';
import { usePuzzleFeedState } from './puzzle-feed-context';
import { usePuzzleGame } from './puzzle-game-context';
import { usePuzzleFeedConfig } from './use-puzzle-feed-config';
import { usePuzzleFeedPoolStats } from './use-puzzle-feed-pool-stats';
import { usePuzzleProfileRatings } from './use-puzzle-profile-ratings';

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
    <FormField
      label={t`Difficulty mode`}
      help={feedModeCaption(props.config.mode, props.profileCaption)}
      group
    >
      {() => (
        <SegmentedControl
          segments={modeSegments}
          selected={props.config.mode}
          onSelect={props.onSelectMode}
          aria-label={t`Difficulty mode`}
          dataSet={{ testid: 'chess-puzzle-feed-mode' }}
        />
      )}
    </FormField>
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
    <FormField
      label={t`Play history`}
      help={t`Filter by puzzles you have never seen, already seen, or failed.`}
      group
    >
      {() => (
        <SegmentedControl
          segments={segments}
          selected={props.historyFilter}
          onSelect={props.onSelect}
          aria-label={t`Play history`}
          dataSet={{ testid: 'chess-puzzle-feed-history' }}
        />
      )}
    </FormField>
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
    <FormField
      label={t`Auto-advance`}
      help={t`Move on to the next puzzle by itself after a solve.`}
      group
    >
      {() => (
        <SegmentedControl
          segments={segments}
          selected={props.autoAdvance}
          onSelect={props.onSelect}
          aria-label={t`Auto-advance`}
          dataSet={{ testid: 'chess-puzzle-feed-auto-advance' }}
        />
      )}
    </FormField>
  );
}

/** The game's themes a feed can be narrowed to, as the game names them. */
function PuzzleFeedThemesSection(props: {
  choices: NonNullable<GamePuzzlesClient['themes']>;
  themes: readonly string[];
  onChange: (themes: string[]) => void;
}): JSX.Element {
  const known = (theme: string): boolean =>
    props.choices.choices.includes(theme);
  const options = props.choices.choices.map((theme) => ({
    value: theme,
    label: props.choices.label(theme),
    searchText: props.choices.label(theme),
    dataSet: { testid: `chess-puzzle-feed-theme-${theme}` },
  }));
  return (
    <Combobox
      label={t`Themes`}
      selectionMode="multiple"
      options={options}
      value={props.themes.filter(known)}
      onValueChange={(next) => {
        props.onChange(next.filter(known));
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
      <StackVertical gap="sm">
        <NumberStepper
          label={t`Rating offset`}
          value={props.config.autoOffset}
          onChange={props.onChangeAutoOffset}
          min={PUZZLE_FEED_AUTO_OFFSET_MIN}
          max={PUZZLE_FEED_AUTO_OFFSET_MAX}
          step={PUZZLE_FEED_AUTO_OFFSET_STEP}
          dataSet={{ testid: 'chess-puzzle-feed-offset' }}
        />
        <P variant="caption" testId="chess-puzzle-feed-target">
          {<Trans>Target rating: {props.targetRating}</Trans>}
        </P>
      </StackVertical>
    </Show>
  );
}

export type PuzzleFeedSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  onFeedConfigApplied?: () => void;
};

type FeedConfigEditors = {
  onSelectMode: (mode: PuzzleFeedMode) => void;
  onChangeCustomRating: (rating: number) => void;
  onChangeAutoOffset: (offset: number) => void;
  onSelectHistory: (filter: PuzzleFeedHistoryFilter) => void;
  onChangeThemes: (themes: string[]) => void;
  onSelectAutoAdvance: (autoAdvance: PuzzleAutoAdvance) => void;
};

/** One edit per field, each a patch on the persisted feed config. */
function feedConfigEditors(
  setConfig: ReturnType<typeof usePuzzleFeedConfig>[1]
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
  const { client } = usePuzzleGame();
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
      <Show when={client.themes} keyed>
        {(choices) => (
          <PuzzleFeedThemesSection
            choices={choices}
            themes={props.config.themes}
            onChange={props.editors.onChangeThemes}
          />
        )}
      </Show>
      <PuzzleAutoAdvanceSection
        autoAdvance={props.config.autoAdvance}
        onSelect={props.editors.onSelectAutoAdvance}
      />
    </>
  );
}

export function PuzzleFeedSettingsModal(
  props: PuzzleFeedSettingsModalProps
): JSX.Element {
  const myId = useMyId();
  const { profileRating } = usePuzzleProfileRatings(myId);
  const [saved, setSaved] = usePuzzleFeedConfig();
  const feed = usePuzzleFeedState();
  const [config, setConfig] = createFeedSettingsDraft(
    saved,
    () => props.visible
  );
  // Customizing the feed is for accounts; a guest is invited to sign in.
  const customize = useDecision(PERMISSION.puzzlesCustomizeFeed);
  const pool = usePuzzleFeedPoolStats(config);
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
          <Show
            when={feed.configReady()}
            fallback={<LoadingState variant="compact" />}
          >
            <StackVertical gap="lg">
              <P variant="caption" testId="chess-puzzle-feed-pool">
                {
                  <Trans>
                    {pool.matched()} matching · {pool.total()} local puzzles
                  </Trans>
                }
              </P>
              <StackVertical gap="xs">
                <P variant="caption">{t`Your rating`}</P>
                <P variant="bodyBold" numeral>
                  {profileCaption}
                </P>
              </StackVertical>
              <PuzzleFeedSections
                config={config()}
                profileCaption={profileCaption}
                targetRating={targetRating()}
                editors={editors}
              />
            </StackVertical>
          </Show>
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
