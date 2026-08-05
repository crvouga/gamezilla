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
import { useRef, type ReactNode } from 'react';

import type { AccountSwitchPhase } from './account-switch-context';
import { useAccountSwitchSurface } from './account-switch-context';
import { isAccountSwitchSurfaceVisible } from './account-switch-surface-visibility';
import { latchSwitchChrome, type SwitchChrome } from './latch-switch-chrome';

/** Matches `Button` `md` minHeight so loading reserves the same footer band. */
const FOOTER_ACTION_MIN_HEIGHT = 40;
const STATE_AREA_HEIGHT = 200;

function useLatchedSwitchChrome(
  phase: AccountSwitchPhase,
  error: Error | null,
  pendingDisplayTitle: string | null
): SwitchChrome | null {
  const latchRef = useRef<SwitchChrome | null>(null);
  latchRef.current = latchSwitchChrome(
    latchRef.current,
    phase,
    error,
    pendingDisplayTitle
  );
  return latchRef.current;
}

function StateArea({ children }: { children: ReactNode }): ReactNode {
  return (
    <Box
      sx={{ justifyContent: 'center' }}
      style={{ height: STATE_AREA_HEIGHT, overflow: 'hidden' }}
    >
      {children}
    </Box>
  );
}

/** Footer band always present so loading → success/error does not grow the modal. */
function FooterSlot({ children }: { children?: ReactNode }): ReactNode {
  return (
    <ModalFooter>
      {children ?? <Box style={{ minHeight: FOOTER_ACTION_MIN_HEIGHT }} />}
    </ModalFooter>
  );
}

/** Loading / success / error chrome while an account switch is in flight. */
export function AccountSwitchSurface(): ReactNode {
  const { t } = useLingui();
  const { phase, error, pendingDisplayTitle, retry, dismiss, dismissError } =
    useAccountSwitchSurface();
  const visible = isAccountSwitchSurfaceVisible(phase);
  const chrome = useLatchedSwitchChrome(phase, error, pendingDisplayTitle);

  const onClose = () => {
    if (phase === 'loading') return;
    if (phase === 'error') {
      dismissError();
      return;
    }
    dismiss();
  };

  const displayTitle = chrome?.pendingDisplayTitle ?? null;
  const loadingCaption =
    displayTitle !== null
      ? t`Switching to ${displayTitle}…`
      : t`Switching account…`;
  const successBody =
    displayTitle !== null
      ? t`Now using ${displayTitle}.`
      : t`You're on a different account.`;

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onClose}
      size="medium"
      presentation="modal"
    >
      {chrome !== null ? (
        <AccountSwitchSurfaceBody
          chrome={chrome}
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
      ) : null}
    </ResponsiveSurface>
  );
}

function AccountSwitchSurfaceBody({
  chrome,
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
  chrome: SwitchChrome;
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
  return (
    <>
      <StateArea>
        <PhaseState
          phase={chrome.phase}
          error={chrome.error}
          loadingCaption={loadingCaption}
          successTitle={successTitle}
          successBody={successBody}
          errorTitle={errorTitle}
          retryLabel={retryLabel}
          onRetry={onRetry}
        />
      </StateArea>
      <PhaseFooter
        phase={chrome.phase}
        doneLabel={doneLabel}
        cancelLabel={cancelLabel}
        onDismiss={onDismiss}
        onDismissError={onDismissError}
      />
    </>
  );
}

function PhaseState({
  phase,
  error,
  loadingCaption,
  successTitle,
  successBody,
  errorTitle,
  retryLabel,
  onRetry,
}: {
  phase: Exclude<AccountSwitchPhase, 'idle'>;
  error: Error | null;
  loadingCaption: string;
  successTitle: string;
  successBody: string;
  errorTitle: string;
  retryLabel: string;
  onRetry: () => void;
}): ReactNode {
  if (phase === 'loading') {
    return <LoadingState caption={loadingCaption} />;
  }
  if (phase === 'success') {
    return <SuccessState title={successTitle} body={successBody} />;
  }
  return (
    <ErrorState
      title={errorTitle}
      body={error?.message}
      retry={{ label: retryLabel, onPress: onRetry }}
    />
  );
}

function PhaseFooter({
  phase,
  doneLabel,
  cancelLabel,
  onDismiss,
  onDismissError,
}: {
  phase: Exclude<AccountSwitchPhase, 'idle'>;
  doneLabel: string;
  cancelLabel: string;
  onDismiss: () => void;
  onDismissError: () => void;
}): ReactNode {
  if (phase === 'loading') {
    return <FooterSlot />;
  }
  if (phase === 'success') {
    return (
      <FooterSlot>
        <ModalButton label={doneLabel} onPress={onDismiss} />
      </FooterSlot>
    );
  }
  return (
    <FooterSlot>
      <ModalButton
        label={cancelLabel}
        variant="cancel"
        onPress={onDismissError}
      />
    </FooterSlot>
  );
}
