import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PrivacyScreenView } from './privacy-screen-view';
import type { AccountPrivacyRow } from './use-account-privacy';

const OWNER = '7b1e2c3d-0000-4000-8000-000000000001';

/** The privacy row with no export asked for and no legal hold. */
const NO_EXPORT: AccountPrivacyRow = {
  owner_id: OWNER,
  deletion_at: null,
  erase_by: null,
  erased_at: null,
  export_status: null,
  requested_at: null,
  ready_at: null,
  export_detail: null,
  export_summary: null,
  legal_purpose: null,
  legal_end_condition: null,
};

function row(patch: Partial<AccountPrivacyRow>): AccountPrivacyRow {
  return { ...NO_EXPORT, ...patch };
}

const PREPARING = row({
  export_status: 'Preparing',
  requested_at: '2026-11-02T09:30:00.000Z',
});

const READY = row({
  export_status: 'Ready',
  requested_at: '2026-11-01T09:30:00.000Z',
  ready_at: '2026-11-01T18:00:00.000Z',
  export_summary: 'Profile: avery\nFriends: 4',
  export_detail: '{"profile":{"username":"avery"}}',
});

const PROOF_REQUIRED = {
  icon: KeyRoundIcon,
  title: 'Prove the account again to continue',
  body: 'To keep your data safe, export and deletion need a sign-in from the last 10 minutes. Sign in again, then try once more. Nothing has changed yet.',
  action: { label: 'Sign in', onPress: fn() },
  dataSet: { reason: 'requires_recent_proof' },
} as const;

const OFFLINE = {
  icon: KeyRoundIcon,
  title: 'This choice needs a connection',
  body: 'Export and deletion only happen while you are online, so nothing is saved to send later. Reconnect, then try again.',
  dataSet: { reason: 'requires_connection' },
} as const;

const meta = {
  id: 'screens-privacy',
  title: 'Screens/Privacy/Account privacy',
  component: PrivacyScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: {
      exclude: ['row', 'download', 'exportDenial', 'deletionDenial'],
    },
  },
  args: {
    status: 'ready',
    row: NO_EXPORT,
    exportPhase: 'none',
    replacingExport: false,
    download: { kind: 'none' },
    deletionConfirming: false,
    deletionReceipt: null,
    onRequestExport: fn(async () => undefined),
    onReviewReplaceExport: fn(),
    onCancelReplaceExport: fn(),
    onReviewDelete: fn(),
    onCancelDelete: fn(),
    onConfirmDelete: fn(async () => undefined),
  },
} satisfies Meta<typeof PrivacyScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No export yet: what deletion means, the export request and Delete. */
export const NoExport: Story = {};

/** The privacy row is still being read; the export area waits. */
export const Loading: Story = { args: { status: 'loading', row: null } };

/** An export was asked for: it is being prepared, with its ready-by time. */
export const Preparing: Story = {
  args: { row: PREPARING, exportPhase: 'preparing' },
};

/** The promised 24 hours passed: the export is late and can be asked again. */
export const Overdue: Story = {
  args: { row: PREPARING, exportPhase: 'overdue' },
};

/** The export failed; nothing partial is offered. */
export const ExportFailed: Story = {
  args: { row: row({ export_status: 'ExportFailed' }) },
};

/** The export is ready: both downloads, and asking again is confirm-first. */
export const ReadyToDownload: Story = {
  args: {
    row: READY,
    exportPhase: 'readyToReplace',
    download: {
      kind: 'ready',
      summary: READY.export_summary ?? '',
      detail: READY.export_detail ?? '',
    },
  },
};

/** Asking again while one is ready: confirm replacing the ready export. */
export const ConfirmReplaceExport: Story = {
  args: { ...ReadyToDownload.args, replacingExport: true },
};

/** The ready export is past its 7-day window. */
export const Expired: Story = {
  args: {
    row: row({ ...READY, export_status: 'Expired' }),
    download: { kind: 'expired' },
  },
};

/** The ready export needs a recent sign-in before it can be downloaded. */
export const DownloadNeedsProof: Story = {
  args: {
    row: READY,
    exportPhase: 'readyToReplace',
    download: {
      kind: 'denied',
      denial: {
        ...PROOF_REQUIRED,
        dataSet: {
          ...PROOF_REQUIRED.dataSet,
          testid: 'privacy-download-denial',
        },
      },
    },
  },
};

/** `/profile/privacy/export/:accountId` for another account's export. */
export const ExportOwnerDenied: Story = {
  args: { row: READY, download: { kind: 'ownerDenied' } },
};

/** Requesting the export was refused: it needs a recent sign-in. */
export const ExportNeedsProof: Story = {
  args: {
    exportDenial: {
      ...PROOF_REQUIRED,
      dataSet: { ...PROOF_REQUIRED.dataSet, testid: 'privacy-export-denial' },
    },
  },
};

/** Requesting the export offline is refused: nothing queues to send later. */
export const ExportOffline: Story = {
  args: {
    exportDenial: {
      ...OFFLINE,
      dataSet: { ...OFFLINE.dataSet, testid: 'privacy-export-denial' },
    },
  },
};

/** A legal preservation obligation is disclosed with its end condition. */
export const LegalObligation: Story = {
  args: {
    row: row({
      legal_purpose: 'Tax audit for fiscal year 2025',
      legal_end_condition: 'until the audit closes or by 2027-06-30',
    }),
  },
};

/** Delete account opens a destructive, confirm-first dialog. */
export const ConfirmDeletion: Story = { args: { deletionConfirming: true } };

/** Deletion was refused: it needs a recent sign-in. */
export const DeletionNeedsProof: Story = {
  args: {
    deletionDenial: {
      ...PROOF_REQUIRED,
      dataSet: { ...PROOF_REQUIRED.dataSet, testid: 'privacy-delete-denial' },
    },
  },
};

/** Deletion offline is refused: nothing is deleted later by surprise. */
export const DeletionOffline: Story = {
  args: {
    deletionDenial: {
      ...OFFLINE,
      dataSet: { ...OFFLINE.dataSet, testid: 'privacy-delete-denial' },
    },
  },
};

/** Deletion confirmed; the membership's cancellation is still pending. */
export const DeletionConfirmed: Story = {
  args: {
    deletionReceipt: {
      eraseBy: '2026-12-02T12:00:00.000Z',
      cancellationComplete: false,
    },
  },
};

/** Deletion confirmed and the payment provider confirmed the cancellation. */
export const DeletionConfirmedCancellationComplete: Story = {
  args: {
    deletionReceipt: {
      eraseBy: '2026-12-02T12:00:00.000Z',
      cancellationComplete: true,
    },
  },
};

/** Pressing Delete account asks the container to review the deletion. */
export const ReviewDeletion: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('privacy-delete-review'));
    await expect(args.onReviewDelete).toHaveBeenCalledOnce();
  },
};
