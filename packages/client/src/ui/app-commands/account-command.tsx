import { useAuth } from '@gamezilla/auth/client/auth-context';
import { RegisterCommand } from '@gamezilla/ui';
import { useAsync } from '@gamezilla/lib/async/use-async';
import { useLingui } from '@lingui/react/macro';

export function AccountCommand() {
  const { t } = useLingui();
  const { isAuthenticated, openSignOutConfirm, openSignInModal } = useAuth();
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
      icon={isAuthenticated ? 'arrow.right.from.bracket' : 'right.to.bracket'}
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
