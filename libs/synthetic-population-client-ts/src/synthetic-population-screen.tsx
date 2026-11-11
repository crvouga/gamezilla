import {
  SYNTHETIC_POPULATION_EVENTS_PATH,
  SYNTHETIC_POPULATION_SETTINGS_PATH,
  SYNTHETIC_POPULATION_WORKERS_PATH,
  SYNTHETIC_USER_DIRECTORY_PATH,
} from '@libs/observatory-shared-ts/observatory-routes';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useCan, useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import {
  type SyntheticPopulationDestination,
  SyntheticPopulationScreenView,
} from './synthetic-population-screen-view';

const DESTINATIONS: Readonly<Record<SyntheticPopulationDestination, string>> = {
  directory: SYNTHETIC_USER_DIRECTORY_PATH,
  workers: SYNTHETIC_POPULATION_WORKERS_PATH,
  events: SYNTHETIC_POPULATION_EVENTS_PATH,
  settings: SYNTHETIC_POPULATION_SETTINGS_PATH,
};

function SyntheticPopulationContent(): JSX.Element {
  const router = useRouter();
  const configure = useCan(PERMISSION.syntheticPopulationConfigure);
  return (
    <SyntheticPopulationScreenView
      canConfigure={configure()}
      onOpen={(destination) => router.push(DESTINATIONS[destination])}
    />
  );
}

/** `/admin/observatory/synthetic-users`: wires `SyntheticPopulationScreenView`. */
export function SyntheticPopulationScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationView);
  return (
    <DecisionGate
      decision={decision()}
      testId="synthetic-population-denied"
      denied={(denial) => (
        <SyntheticPopulationScreenView
          denial={denial}
          canConfigure={false}
          onOpen={() => undefined}
        />
      )}
    >
      <SyntheticPopulationContent />
    </DecisionGate>
  );
}
