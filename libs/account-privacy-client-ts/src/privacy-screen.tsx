import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { useParams } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { PrivacyScreenView } from './privacy-screen-view';
import { useAccountDeletion } from './use-account-deletion';
import { useAccountPrivacy } from './use-account-privacy';
import { useExportChoice } from './use-export-choice';
import { useExportDownload } from './use-export-download';
import { useOptionalDenialView } from './use-optional-denial-view';

/**
 * `/profile/privacy` and `/profile/privacy/export/:accountId`: wires
 * `PrivacyScreenView` to the synced privacy row, the export and deletion
 * mutations and the permission system.
 */
export function PrivacyScreen(): JSX.Element {
  const params = useParams();
  const myId = useMyId();
  const privacy = useAccountPrivacy();
  const exportChoice = useExportChoice(privacy.row);
  const download = useExportDownload(
    privacy.row,
    () => params['accountId'] ?? myId()
  );
  const deletion = useAccountDeletion();
  const deletionDenial = useOptionalDenialView(
    deletion.denial,
    'privacy-delete-denial'
  );
  const receipt = () => {
    const eraseBy = deletion.receipt();
    return eraseBy === null
      ? null
      : {
          eraseBy,
          cancellationComplete: deletion.cancellationStatus() === 'complete',
        };
  };
  return (
    <PrivacyScreenView
      status={privacy.isLoading() ? 'loading' : 'ready'}
      row={privacy.row()}
      exportPhase={exportChoice.phase()}
      exportDenial={exportChoice.denial()}
      replacingExport={exportChoice.replacing()}
      download={download()}
      deletionConfirming={deletion.confirming()}
      deletionDenial={deletionDenial()}
      deletionReceipt={receipt()}
      onRequestExport={exportChoice.request}
      onReviewReplaceExport={exportChoice.reviewReplace}
      onCancelReplaceExport={exportChoice.cancelReplace}
      onReviewDelete={deletion.review}
      onCancelDelete={deletion.cancel}
      onConfirmDelete={deletion.confirm}
    />
  );
}
