import { useLingui } from '@lingui/react/macro';
import {
  Box,
  ErrorState,
  LoadingState,
  ModalButton,
  ModalFooter,
  ResponsiveSurface,
  SuccessState,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

import type { AccountSwitchPhase } from './account-switch-context';
import { useAccountSwitchSurface } from './account-switch-context';
import { isAccountSwitchSurfaceVisible } from './account-switch-surface-visibility';

const STATE_AREA_MIN_HEIGHT = 200;

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

/** Loading / success / error chrome while an account switch is in flight. */
export function AccountSwitchSurface(): ReactNode {
  const { t } = useLingui();
  const { phase, error, pendingDisplayTitle, retry, dismiss, dismissError } =
    useAccountSwitchSurface();
  const visible = isAccountSwitchSurfaceVisible(phase);

  const onClose = () => {
    if (phase === 'loading') return;
    if (phase === 'error') {
      dismissError();
      return;
    }
    dismiss();
  };

  const loadingCaption =
    pendingDisplayTitle !== null
      ? t`Switching to ${pendingDisplayTitle}…`
      : t`Switching account…`;
  const successBody =
    pendingDisplayTitle !== null
      ? t`Now using ${pendingDisplayTitle}.`
      : t`You're on a different account.`;

  return (
    <ResponsiveSurface visible={visible} onClose={onClose} size="medium">
      <AccountSwitchSurfaceBody
        phase={phase}
        error={error}
        onRetry={retry}
        onDismiss={dismiss}
        onDismissError={dismissError}
        loadingCaption={loadingCaption}
        successTitle={t`Switched account`}
        successBody={successBody}
        errorTitle={t`Could not switch accounts`}
        doneLabel={t`Done`}
        retryLabel={t`Try again`}
        cancelLabel={t`Cancel`}
      />
    </ResponsiveSurface>
  );
}

function AccountSwitchSurfaceBody({
  phase,
  error,
  onRetry,
  onDismiss,
  onDismissError,
  loadingCaption,
  successTitle,
  successBody,
  errorTitle,
  doneLabel,
  retryLabel,
  cancelLabel,
}: {
  phase: AccountSwitchPhase;
  error: Error | null;
  onRetry: () => void;
  onDismiss: () => void;
  onDismissError: () => void;
  loadingCaption: string;
  successTitle: string;
  successBody: string;
  errorTitle: string;
  doneLabel: string;
  retryLabel: string;
  cancelLabel: string;
}): ReactNode {
  switch (phase) {
    case 'loading':
      return (
        <StateArea>
          <LoadingState caption={loadingCaption} />
        </StateArea>
      );
    case 'success':
      return (
        <>
          <StateArea>
            <SuccessState title={successTitle} body={successBody} />
          </StateArea>
          <ModalFooter>
            <ModalButton label={doneLabel} onPress={onDismiss} />
          </ModalFooter>
        </>
      );
    case 'error':
      return (
        <>
          <StateArea>
            <ErrorState
              title={errorTitle}
              body={error?.message}
              retry={{ label: retryLabel, onPress: onRetry }}
            />
          </StateArea>
          <ModalFooter>
            <ModalButton
              label={cancelLabel}
              variant="cancel"
              onPress={onDismissError}
            />
          </ModalFooter>
        </>
      );
    default:
      return null;
  }
}
