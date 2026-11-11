import {
  ONLINE_NOW_PATH,
  SYNTHETIC_USERS_PATH,
} from '@libs/observatory-shared-ts/observatory-routes';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useCan, useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import { UserObservatoryScreenView } from './user-observatory-screen-view';

function UserObservatoryContent(): JSX.Element {
  const router = useRouter();
  const syntheticUsers = useCan(PERMISSION.syntheticPopulationView);
  return (
    <UserObservatoryScreenView
      onOpenOnlineNow={() => router.push(ONLINE_NOW_PATH)}
      canOpenSyntheticUsers={syntheticUsers()}
      onOpenSyntheticUsers={() => router.push(SYNTHETIC_USERS_PATH)}
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
          onOpenOnlineNow={() => undefined}
          canOpenSyntheticUsers={false}
          onOpenSyntheticUsers={() => undefined}
        />
      )}
    >
      <UserObservatoryContent />
    </DecisionGate>
  );
}
