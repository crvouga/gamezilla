import {
  liveWatchPath,
  SYNTHETIC_USERS_PATH,
  syntheticUserPath,
} from '@libs/observatory-shared-ts/observatory-routes';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useCan, useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import { OnlineNow } from './online-now';
import { UserObservatoryScreenView } from './user-observatory-screen-view';

function UserObservatoryContent(): JSX.Element {
  const router = useRouter();
  const watch = useCan(PERMISSION.observatoryWatch);
  const control = useCan(PERMISSION.syntheticPopulationControl);
  const syntheticUsers = useCan(PERMISSION.syntheticPopulationView);
  return (
    <UserObservatoryScreenView
      canOpenSyntheticUsers={syntheticUsers()}
      onOpenSyntheticUsers={() => router.push(SYNTHETIC_USERS_PATH)}
      onlineNow={() => (
        <OnlineNow
          canWatch={watch()}
          canControl={control()}
          watch={(id) => router.push(liveWatchPath(id))}
          controlPanel={(id) => router.push(syntheticUserPath(id))}
        />
      )}
    />
  );
}

/** `/admin/observatory`: wires `UserObservatoryScreenView`. */
export function UserObservatoryScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.observatoryView);
  return (
    <DecisionGate
      decision={decision()}
      testId="observatory-denied"
      denied={(denial) => (
        <UserObservatoryScreenView
          denial={denial}
          canOpenSyntheticUsers={false}
          onOpenSyntheticUsers={() => undefined}
        />
      )}
    >
      <UserObservatoryContent />
    </DecisionGate>
  );
}
