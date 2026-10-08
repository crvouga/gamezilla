import { useLingui } from '@lingui/solid/macro';
import { ModalBackdrop } from '@pkgs/ui-root-client/modal-backdrop';
import { ModalContent } from '@pkgs/ui-root-client/modal-content';
import {
  ModalButton,
  ModalFooter,
  ModalHeader,
} from '@pkgs/ui-root-client/modal-parts';
import { ModalRoot } from '@pkgs/ui-root-client/modal-root';
import { CommitNavigator } from './commit-list';
import type { ReportFetcher } from './fetcher';

export function RevisionPicker(props: {
  fetcher: ReportFetcher;
  selectedSha: string;
  onOpen: (sha: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  return (
    <ModalRoot visible onRequestClose={props.onClose}>
      <ModalBackdrop onClick={props.onClose}>
        <ModalContent size="large">
          <ModalHeader title={t`Change revision`} />
          <CommitNavigator
            fetcher={props.fetcher}
            selectedSha={props.selectedSha}
            onOpen={(sha) => {
              props.onClose();
              props.onOpen(sha);
            }}
          />
          <ModalFooter>
            <ModalButton
              label={t`Cancel`}
              variant="cancel"
              onClick={props.onClose}
              dataSet={{ testid: 'report-close-revisions' }}
            />
          </ModalFooter>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}
