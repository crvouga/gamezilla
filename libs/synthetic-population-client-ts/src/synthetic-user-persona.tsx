import type {
  Persona,
  SkillLevel,
} from '@libs/synthetic-population-shared-ts/persona';
import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { type JSX, Show } from 'solid-js';

/** A skill level as people say it. */
export function useSkillLabel(): (level: SkillLevel) => string {
  const { t } = useLingui();
  const labels: Record<SkillLevel, () => string> = {
    beginner: () => t`Beginner`,
    casual: () => t`Casual`,
    intermediate: () => t`Intermediate`,
    strong: () => t`Strong`,
  };
  return (level) => labels[level]();
}

/**
 * One line about who a Synthetic User is as a player, for its directory row:
 * home region, skill level and favorite games (left out when it has none).
 */
export function usePersonaCaption(): (persona: Persona) => string {
  const { t } = useLingui();
  const skill = useSkillLabel();
  return (persona) => {
    const region = persona.homeRegion;
    const level = skill(persona.skillLevel);
    const games = persona.favoriteGames.join(', ');
    return persona.favoriteGames.length === 0
      ? t`${region} · ${level}`
      : t`${region} · ${level} · Favorite games: ${games}`;
  };
}

function hour(value: number): string {
  return `${String(value).padStart(2, '0')}:00`;
}

/**
 * Who a Synthetic User is as a player: home region, skill level, favorite
 * games, daily schedule and thinking time. A user recorded before personas
 * says so instead.
 */
export function SyntheticUserPersona(props: {
  persona: Persona | null;
}): JSX.Element {
  const { t } = useLingui();
  const skill = useSkillLabel();
  return (
    <MenuSection title={<Trans>Persona</Trans>}>
      <Show
        when={props.persona}
        fallback={
          <MenuRow
            title={<Trans>Persona</Trans>}
            value={t`Not recorded for this Synthetic User`}
            valueLines={2}
            dataSet={{ testid: 'synthetic-user-persona-missing' }}
          />
        }
      >
        {(persona) => (
          <>
            <MenuRow
              title={<Trans>Home region</Trans>}
              value={persona().homeRegion}
              dataSet={{ testid: 'synthetic-user-persona-region' }}
            />
            <MenuRow
              title={<Trans>Skill level</Trans>}
              value={skill(persona().skillLevel)}
              dataSet={{ testid: 'synthetic-user-persona-skill' }}
            />
            <MenuRow
              title={<Trans>Favorite games</Trans>}
              value={persona().favoriteGames.join(', ')}
              valueLines={2}
            />
            <MenuRow
              title={<Trans>Daily schedule</Trans>}
              value={`${hour(persona().dailySchedule.startHour)}–${hour(persona().dailySchedule.endHour)} ${persona().dailySchedule.timeZone}`}
              valueLines={2}
            />
            <MenuRow
              title={<Trans>Thinking time</Trans>}
              value={t`${persona().thinkingTime.minMs / 1000}–${persona().thinkingTime.maxMs / 1000} seconds a move`}
            />
          </>
        )}
      </Show>
    </MenuSection>
  );
}
