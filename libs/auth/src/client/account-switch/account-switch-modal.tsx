import { useLingui } from '@lingui/react/macro';
import {
  Box,
  ErrorState,
  ModalBackdrop,
  ModalButton,
  ModalContent,
  ModalFooter,
  ModalRoot,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

const STATE_AREA_MIN_HEIGHT = 200;

export type AccountSwitchModalProps = {
  visible: boolean;
  error: Error | null;
  onRetry: () => void;
  onDismiss: () => void;
};

/** Error-only surface when an account switch fails. */
export function AccountSwitchModal({
  visible,
  error,
  onRetry,
  onDismiss,
}: AccountSwitchModalProps): ReactNode {
  const { t } = useLingui();
  return (
    <ModalRoot visible={visible} onRequestClose={onDismiss}>
      <ModalBackdrop onPress={onDismiss}>
        <ModalContent size="medium">
          <Box
            sx={{ justifyContent: 'center' }}
            style={{ minHeight: STATE_AREA_MIN_HEIGHT }}
          >
            <ErrorState
              title={t`Could not switch accounts`}
              body={error?.message}
              retry={{ label: t`Try again`, onPress: onRetry }}
            />
          </Box>
          <ModalFooter>
            <ModalButton
              label={t`Cancel`}
              variant="cancel"
              onPress={onDismiss}
            />
          </ModalFooter>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}
