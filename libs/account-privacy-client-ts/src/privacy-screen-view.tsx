import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { ExportChoice } from './export-choice';
import { ExportDownload } from './export-download';
import type { PrivacyActionAccess } from './privacy-action-access';
import { formatPrivacyDay, timestampMs } from './privacy-dates';
import { PrivacyExplanation } from './privacy-explanation';
import type { ExportDownloadState, ExportPhase } from './privacy-export-state';
import { PrivacyScreenLayout } from './privacy-screen-layout';
import type { AccountPrivacyRow } from './use-account-privacy';

/** A confirmed deletion's receipt, once it is on record. */
export type DeletionReceipt = {
  /** When ordinary personal data will be erased by (ISO). */
  readonly eraseBy: string;
  /** The payment provider has confirmed the membership is canceled. */
  readonly cancellationComplete: boolean;
};

export type PrivacyScreenViewProps = {
  /** Whether the privacy row is still being read. */
  readonly status: 'loading' | 'ready';
  /** The caller's privacy row, `null` when there is none. */
  readonly row: AccountPrivacyRow | null;
  readonly exportPhase: ExportPhase;
  readonly exportAccess: PrivacyActionAccess;
  readonly deletionAccess: PrivacyActionAccess;
  /** Why the last export request was refused, with its way forward. */
  readonly exportDenial?: DenialView | undefined;
  /** The replace-your-ready-export confirmation is open. */
  readonly replacingExport: boolean;
  readonly download: ExportDownloadState;
  /** The permanent-deletion confirmation is open. */
  readonly deletionConfirming: boolean;
  /** Why deletion was refused (e.g. a recent proof is required). */
  readonly deletionDenial?: DenialView | undefined;
  readonly deletionReceipt: DeletionReceipt | null;
  /** Asks for a new export; rejects with the message the button shows. */
  readonly onRequestExport: () => Promise<void>;
  readonly onReviewReplaceExport: () => void;
  readonly onCancelReplaceExport: () => void;
  readonly onReviewDelete: () => void;
  readonly onCancelDelete: () => void;
  /** Deletes the account; rejects with the message the dialog shows. */
  readonly onConfirmDelete: () => Promise<void>;
};

/** The export controls and their status, once the privacy row is read. */
function PrivacyExport(props: PrivacyScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Show
      when={props.status === 'ready'}
      fallback={
        <LoadingState
          variant="compact"
          caption={t`Loading your privacy settings…`}
        />
      }
    >
      <StackVertical gap="lg">
        <ExportChoice
          row={props.row}
          phase={props.exportPhase}
          access={props.exportAccess}
          denial={props.exportDenial}
          replacing={props.replacingExport}
          onRequest={props.onRequestExport}
          onReviewReplace={props.onReviewReplaceExport}
          onCancelReplace={props.onCancelReplaceExport}
        />
        <ExportDownload state={props.download} />
      </StackVertical>
    </Show>
  );
}

/** The applicable obligation stays with the complete retention explanation. */
function PrivacyLegalNotice(props: PrivacyScreenViewProps): JSX.Element {
  return (
    <Show when={props.row?.legal_purpose}>
      <Notice dataSet={{ testid: 'privacy-legal-obligation' }}>
        {props.row?.legal_purpose}: {props.row?.legal_end_condition}
      </Notice>
    </Show>
  );
}

/** A persisted acknowledgment describes a past deletion, not the current account's access. */
function DeletionOutcome(props: {
  readonly receipt: DeletionReceipt;
}): JSX.Element {
  const { t } = useLingui();
  const { i18n } = useLinguiRuntime();
  const eraseBy = (): string => {
    const ms = timestampMs(props.receipt.eraseBy);
    return ms === null ? '' : formatPrivacyDay(ms, i18n().locale);
  };
  return (
    <StackVertical gap="sm" testId="privacy-deletion-receipt">
      <H2>
        <Trans>Account deletion receipt</Trans>
      </H2>
      <P testId="privacy-deletion-outcome">
        {t`Account deletion was confirmed. Ordinary personal-data erasure will complete by ${eraseBy()}.`}
      </P>
      <P tone="secondary" testId="privacy-cancellation-outcome">
        <Show
          when={props.receipt.cancellationComplete}
          fallback={
            <Trans>
              Membership cancellation is still being completed. Nothing more is
              needed from you.
            </Trans>
          }
        >
          <Trans>Membership cancellation has completed.</Trans>
        </Show>
      </P>
    </StackVertical>
  );
}

function DeletionSection(props: PrivacyScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="md" testId="privacy-deletion-task">
      <H2>
        <Trans>Delete your account</Trans>
      </H2>
      <P>
        <Trans>
          Account deletion is permanent. Take an export first if you want a copy
          of your personal data.
        </Trans>
      </P>
      <Show when={props.deletionAccess.kind === 'allowed'}>
        <Button
          title={t`Delete account`}
          intent="danger"
          onClick={() => props.onReviewDelete()}
          dataSet={{ testid: 'privacy-delete-review' }}
        />
      </Show>
      <Show
        when={
          props.deletionAccess.kind === 'denied'
            ? props.deletionAccess.denial
            : undefined
        }
      >
        {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
      </Show>
      <Show when={props.deletionDenial}>
        {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
      </Show>
    </StackVertical>
  );
}

/**
 * `/profile/privacy` and `/profile/privacy/export/:accountId`,
 * presentational: what deletion means, the personal-data export (request,
 * progress, download or why not) and permanent deletion with its
 * confirmation and receipt. `PrivacyScreen` wires it to sync and permissions.
 */
export function PrivacyScreenView(props: PrivacyScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <PrivacyScreenLayout>
      <StackVertical gap="2xl">
        <Show when={props.deletionReceipt}>
          {(receipt) => <DeletionOutcome receipt={receipt()} />}
        </Show>
        <StackVertical gap="md" testId="privacy-export-task">
          <H2>
            <Trans>Export your data</Trans>
          </H2>
          <PrivacyExport {...props} />
        </StackVertical>
        <DeletionSection {...props} />
        <PrivacyExplanation legalNotice={<PrivacyLegalNotice {...props} />} />
      </StackVertical>
      <MutationModal
        visible={props.deletionConfirming}
        onClose={() => props.onCancelDelete()}
        title={t`Permanently delete account?`}
        message={t`This cannot be undone. Every device will be signed out. Your hosted spaces and future membership charges will end. If you have Plus, Plus ends at once: the remaining paid time and Plus credit are not refunded. Take an export first if you want a copy of your personal data.`}
        operation={() => props.onConfirmDelete()}
        submitLabel={t`Confirm permanent deletion`}
        variant="destructive"
        successTitle={t`Account deletion confirmed`}
        successBody={t`Ordinary personal data will be erased within 30 days.`}
        submitDataSet={{ testid: 'privacy-delete-confirm' }}
        dataSet={{ testid: 'privacy-delete-modal' }}
      />
    </PrivacyScreenLayout>
  );
}
