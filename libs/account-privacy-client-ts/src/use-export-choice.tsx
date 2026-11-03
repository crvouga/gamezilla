import { requestPersonalDataExportMutation } from '@libs/account-privacy-shared-ts/request-personal-data-export-mutation';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { usePermissions } from '@libs/permissions-client-ts/use-permissions';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import { createTimedValue } from '@pkgs/clock-client-ts/solid';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { type Accessor, createSignal } from 'solid-js';
import { privacyDenial } from './privacy-denial';
import type { ExportPhase } from './privacy-export-state';
import { exportPhaseAt, exportPhaseChangesAtMs } from './privacy-export-state';
import type { AccountPrivacyRow } from './use-account-privacy';
import { useOptionalDenialView } from './use-optional-denial-view';

function useExportRequest(onDenied: (decision: Decision) => void) {
  const { t } = useLingui();
  const client = useMutationClient();
  const permissions = usePermissions();
  return async () => {
    const decision = permissions.can(PERMISSION.profileExportData);
    if (!decision.allowed) {
      onDenied(decision);
      throw new Error(t`The export was not requested. Use the choice shown.`);
    }
    const result = await client.mutate(requestPersonalDataExportMutation, {});
    if (result.ok) return;
    const refused = privacyDenial(
      result.failures[0],
      PERMISSION.profileExportData
    );
    if (refused !== null) {
      onDenied(refused);
      throw new Error(t`The export was not requested. Use the choice shown.`);
    }
    throw new Error(t`The export could not be requested. Try again.`);
  };
}

export type ExportChoiceState = {
  readonly phase: Accessor<ExportPhase>;
  readonly denial: Accessor<DenialView | undefined>;
  readonly replacing: Accessor<boolean>;
  readonly request: () => Promise<void>;
  readonly reviewReplace: () => void;
  readonly cancelReplace: () => void;
};

/** The export request's state and its mutation, for `ExportChoice`. */
export function useExportChoice(
  row: Accessor<AccountPrivacyRow | null>
): ExportChoiceState {
  const [denial, setDenial] = createSignal<Decision | null>(null);
  const [replacing, setReplacing] = createSignal(false);
  const phase = createTimedValue<ExportPhase>(
    (nowMs) => exportPhaseAt(row(), nowMs),
    (current) => exportPhaseChangesAtMs(row(), current)
  );
  const requestExport = useExportRequest((decision) => {
    setDenial(decision);
    setReplacing(false);
  });
  return {
    phase,
    denial: useOptionalDenialView(denial, 'privacy-export-denial'),
    replacing,
    request: async () => {
      setDenial(null);
      await requestExport();
    },
    reviewReplace: () => setReplacing(true),
    cancelReplace: () => setReplacing(false),
  };
}
