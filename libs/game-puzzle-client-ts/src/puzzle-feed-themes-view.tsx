import { Handles } from '@libs/test-ids-shared-ts/handles';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ChipGroup } from '@pkgs/ui-root-client-ts/chip-group';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { SearchIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import type {
  PuzzleFeedThemes,
  PuzzlePlayScreenViewProps,
} from './puzzle-play-screen-model';

const NO_THEMES: PuzzleFeedThemes = { choices: [], label: (theme) => theme };

/** The themes whose name holds `query`, as the game names them. */
function matchingThemes(
  themes: PuzzleFeedThemes,
  query: string
): readonly string[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return themes.choices;
  return themes.choices.filter((theme) =>
    themes.label(theme).toLowerCase().includes(needle)
  );
}

/**
 * The chosen themes after the shown ones were set to `shownChosen`: a theme
 * the search hides keeps its choice. In the game's own order.
 */
function mergeChosen(
  themes: PuzzleFeedThemes,
  args: {
    readonly chosen: readonly string[];
    readonly shown: readonly string[];
    readonly shownChosen: readonly string[];
  }
): string[] {
  const hidden = args.chosen.filter((theme) => !args.shown.includes(theme));
  const next = new Set([...hidden, ...args.shownChosen]);
  return themes.choices.filter((theme) => next.has(theme));
}

/** How many themes narrow the feed, in words. */
function ChosenCount(props: { readonly count: number }): JSX.Element {
  return (
    <P variant="caption" tone="secondary">
      <Show when={props.count > 0} fallback={<Trans>Any theme</Trans>}>
        <Trans>{props.count} chosen</Trans>
      </Show>
    </P>
  );
}

/**
 * The `feed-themes` place: the themes the feed is narrowed to; none means
 * every theme. A search narrows the list, a theme toggles, and each choice
 * goes to the draft the settings save.
 */
export function PuzzleFeedThemesView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  const [query, setQuery] = createSignal('');
  const themes = (): PuzzleFeedThemes => props.feed.themes ?? NO_THEMES;
  const shown = createMemo(() => matchingThemes(themes(), query()));
  const chosen = (): readonly string[] =>
    props.feed.draft.themes.filter((theme) => themes().choices.includes(theme));
  return (
    <EmbeddedScreen
      screenId="chess-puzzle-feed-themes"
      title={<Trans>Themes</Trans>}
    >
      <StackVertical gap="lg">
        <TextInput
          type="search"
          value={query()}
          onChangeText={setQuery}
          placeholder={t`Search themes…`}
          aria-label={t`Search themes…`}
          autocorrect="off"
          autocapitalize="none"
          startAdornment={<SearchIcon size={18} />}
          dataSet={{ testid: Handles.chessPuzzleFeedThemeSearch }}
        />
        <ChosenCount count={chosen().length} />
        <Show
          when={shown().length > 0}
          fallback={
            <EmptyState
              variant="compact"
              title={<Trans>No matching themes</Trans>}
              body={<Trans>Try another word.</Trans>}
            />
          }
        >
          <ChipGroup
            selection="multiple"
            aria-label={t`Themes`}
            options={shown().map((theme) => ({
              key: theme,
              label: themes().label(theme),
              testid: Handles.chessPuzzleFeedThemeOption(theme),
            }))}
            selected={chosen()}
            onSelect={(shownChosen) =>
              props.feed.onChange({
                themes: mergeChosen(themes(), {
                  chosen: chosen(),
                  shown: shown(),
                  shownChosen,
                }),
              })
            }
          />
        </Show>
        <StackHorizontal>
          <Button
            title={<Trans>Back to settings</Trans>}
            intent="neutral"
            variant="outline"
            onClick={() => props.onBack()}
            dataSet={{ testid: Handles.chessPuzzleFeedThemeDone }}
          />
        </StackHorizontal>
      </StackVertical>
    </EmbeddedScreen>
  );
}
