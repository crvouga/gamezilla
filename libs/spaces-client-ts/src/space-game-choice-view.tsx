import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import {
  SpaceLauncher,
  type SpaceLauncherGame,
} from '@pkgs/ui-root-client-ts/space-launcher';
import { SpaceMenuSheet } from '@pkgs/ui-root-client-ts/space-menu-sheet';
import { SpaceStageTemplate } from '@pkgs/ui-root-client-ts/space-stage-template';
import type { SpaceMenuItem } from '@pkgs/ui-root-client-ts/space-types';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { type SpaceGameFamily, soleMode } from './space-game-families';
import type { SpaceScreenChromeValue } from './space-screen-chrome';
import { ClaimSpaceShell } from './space-shell-claim';

export type SpaceGameChoiceViewProps = {
  /** The space's chrome (`useSpaceScreenChrome`). */
  readonly chrome: SpaceScreenChromeValue;
  /** The shell's notice (`SpaceScreenNotice`). */
  readonly notice?: JSX.Element | undefined;
  /** The games, one tile per family. */
  readonly families: readonly SpaceGameFamily[];
  /** This person picks the space's game (the host); else they watch it. */
  readonly canChoose: boolean;
  /** Picks a game (a mode's id) for the whole space. */
  readonly onChoose: (gameId: string) => void;
};

/** A family's tile: a lone game picks itself, a family opens its modes. */
function launcherGame(family: SpaceGameFamily): SpaceLauncherGame {
  const sole = soleMode(family);
  return {
    key: family.family,
    name: family.title,
    motif: family.motif,
    players: { counts: family.counts, bots: family.bots },
    testId:
      sole === null
        ? Handles.gameFamily(family.family)
        : Handles.gameMenu(sole.id),
  };
}

/** The open family's modes, each picking itself for the space. */
function modeItems(
  family: SpaceGameFamily,
  onChoose: (gameId: string) => void
): readonly SpaceMenuItem[] {
  return family.modes.map((mode) => ({
    id: mode.id,
    label: mode.title,
    onPress: () => onChoose(mode.id),
    testId: Handles.gameMenu(mode.id),
  }));
}

/**
 * The space while no game is chosen: row 1 and the people from the space,
 * then every game as a tile (`SpaceLauncher`). The host picks one; a family
 * of several modes (Light Cycles Duel, Trio, Quad) opens them first. A
 * guest sees the same games, not pressable, and that the host is choosing.
 * It draws its own template, so it claims the space's shell.
 */
export function SpaceGameChoiceView(
  props: SpaceGameChoiceViewProps
): JSX.Element {
  const { t } = useLingui();
  const [openFamily, setOpenFamily] = createSignal<SpaceGameFamily | null>(
    null
  );
  const games = createMemo(() => props.families.map(launcherGame));
  const choose = (key: string): void => {
    const family = props.families.find((each) => each.family === key);
    if (family === undefined) return;
    const sole = soleMode(family);
    if (sole === null) setOpenFamily(family);
    else props.onChoose(sole.id);
  };
  const hostName = (): string =>
    props.chrome.hostName === '' ? t`The host` : props.chrome.hostName;
  return (
    <SpaceStageTemplate
      {...props.chrome}
      phase="choosing"
      notice={props.notice}
    >
      <SpaceLauncher
        role={props.canChoose ? 'host' : 'guest'}
        hostName={hostName()}
        present={props.chrome.people.length}
        games={games()}
        onChoose={choose}
        statusTestId={
          props.canChoose ? undefined : Handles.spaceHostChoosesGame
        }
      />
      <ClaimSpaceShell />
      <Show when={openFamily()} keyed>
        {(family) => (
          <SpaceMenuSheet
            open
            title={family.title}
            items={modeItems(family, props.onChoose)}
            onClose={() => setOpenFamily(null)}
          />
        )}
      </Show>
    </SpaceStageTemplate>
  );
}
