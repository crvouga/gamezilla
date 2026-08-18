import {
  useSignInModal,
  useSignOutModal,
} from '@libs/auth/public/auth-modals-provider';
import { useHasAuthSession } from '@libs/auth/public/use-current-user';
import { useLingui } from '@lingui/react/macro';
import { useAsync } from '@pkgs/async/use-async';
import { LogInIcon, LogOutIcon, RegisterCommand } from '@pkgs/ui';

export function AccountCommand() {
  const { t } = useLingui();
  const isAuthenticated = useHasAuthSession();
  const { open: openSignInModal } = useSignInModal();
  const { open: openSignOutConfirm } = useSignOutModal();
  const { run } = useAsync({
    operation: async () => {
      if (isAuthenticated) {
        openSignOutConfirm();
      } else {
        openSignInModal();
      }
    },
  });
  return (
    <RegisterCommand
      id="auth-toggle"
      title={isAuthenticated ? t`Sign out` : t`Sign in`}
      category={t`Account`}
      icon={isAuthenticated ? LogOutIcon : LogInIcon}
      keywords={[t`sign in`, t`login`, t`google`, t`auth`]}
      run={async () => {
        try {
          await run();
        } catch {
          // Hook state already tracks async errors.
        }
      }}
    />
  );
}
