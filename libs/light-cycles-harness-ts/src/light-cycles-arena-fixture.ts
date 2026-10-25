import {
  restoreDeviceSimulation,
  restoreSharedSimulation,
} from '@libs/game-session-harness-ts/simulation-fixtures';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { LightCyclesRiderCount } from '@libs/light-cycles-shared-ts/light-cycles-config';
import { lightCyclesPositionCodec } from '@libs/light-cycles-shared-ts/light-cycles-position';
import type { LightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { lightCyclesGameId, lightCyclesLineup } from './light-cycles-lineup';

const CODECS = ([2, 3, 4] as const).map((count: LightCyclesRiderCount) =>
  lightCyclesPositionCodec(count)
);

type Arrange = (saved: LightCyclesState) => LightCyclesState;

/** The saved position, rearranged; null for a save of another game. */
function rearranged(position: string, arrange: Arrange): string | null {
  const codec = CODECS.find((each) => each.decode(position) !== null);
  if (codec === undefined) return null;
  return codec.encode(arrange(codec.decode(position)!));
}

/**
 * The Light Cycles game resumes from its saved live state holding the arena
 * `arrange` makes of it: the room's for a shared game, the device's for
 * practice. The game authority recovers it through its own validation, so a
 * position the strict codec refuses fails at encoding or at recovery.
 */
export async function restoreLightCyclesArena(
  s: ProductHarness,
  arrange: Arrange
): Promise<void> {
  const lineup = lightCyclesLineup(s);
  const fixture = (position: string) => rearranged(position, arrange);
  if (lineup.practice)
    await restoreDeviceSimulation(
      s,
      { actor: lineup.host, gameId: lightCyclesGameId(lineup.count) },
      fixture
    );
  else await restoreSharedSimulation(s, fixture);
}
