import { useLingui } from '@lingui/react/macro';
import {
  Box,
  ErrorState,
  LoadingState,
  ModalBackdrop,
  ModalButton,
  ModalContent,
  ModalFooter,
  ModalRoot,
  MutationStateTransition,
  SuccessState,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

import type { AccountSwitchPhase } from './account-switch-context';

const STATE_AREA_MIN_HEIGHT = 200;

export type AccountSwitchModalProps = {
  visible: boolean;
  phase: AccountSwitchPhase;
  error: Error | null;
  onRetry: () => void;
  onDismissError: () => void;
};

export function AccountSwitchModal({
  visible,
  phase,
  error,
  onRetry,
  onDismissError,
}: AccountSwitchModalProps): ReactNode {
  const surfaceClose =
    phase === 'loading' || phase === 'success'
      ? () => undefined
      : onDismissError;

  return (
    <ModalRoot visible={visible} onRequestClose={surfaceClose}>
      <ModalBackdrop onPress={surfaceClose}>
        <ModalContent size="medium">
          <MutationStateTransition stateKey={phase} active={visible}>
            <AccountSwitchModalBody
              phase={phase}
              error={error}
              onRetry={onRetry}
              onDismissError={onDismissError}
            />
          </MutationStateTransition>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}

function AccountSwitchModalBody({
  phase,
  error,
  onRetry,
  onDismissError,
}: {
  phase: AccountSwitchPhase;
  error: Error | null;
  onRetry: () => void;
  onDismissError: () => void;
}): ReactNode {
  const { t } = useLingui();
  if (phase === 'loading') {
    return (
      <StateArea>
        <LoadingState caption={t`Switching account…`} />
      </StateArea>
    );
  }
  if (phase === 'success') {
    return (
      <StateArea>
        <SuccessState title={t`Switched accounts`} />
      </StateArea>
    );
  }
  if (phase === 'error') {
    return (
      <>
        <StateArea>
          <ErrorState
            title={t`Could not switch accounts`}
            body={error?.message}
            retry={{ label: t`Try again`, onPress: onRetry }}
          />
        </StateArea>
        <ModalFooter>
          <ModalButton
            label={t`Cancel`}
            variant="cancel"
            onPress={onDismissError}
          />
        </ModalFooter>
      </>
    );
  }
  return null;
}

function StateArea({ children }: { children: ReactNode }): ReactNode {
  return (
    <Box
      sx={{ justifyContent: 'center' }}
      style={{ minHeight: STATE_AREA_MIN_HEIGHT }}
    >
      {children}
    </Box>
  );
}
