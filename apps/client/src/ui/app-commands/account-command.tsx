import { useAuth } from '@gamezilla/client/auth/auth-context';
import { RegisterCommand } from '@gamezilla/lib/ui';
import { useAsync } from '@gamezilla/lib/async/use-async';
import { useLingui } from '@gamezilla/lib/i18n';

export function AccountCommand() {
  const { t } = useLingui();
  const auth = useAuth();
  const { run } = useAsync({
    operation: async () => {
      if (auth.mode === 'signed-in') {
        auth.openSignOutConfirm();
      } else {
        auth.openSignInModal();
      }
    },
  });
  return (
    <RegisterCommand
      id="auth-toggle"
      title={auth.mode === 'signed-in' ? t`Sign out` : t`Sign in`}
      category={t`Account`}
      icon={
        auth.mode === 'signed-in'
          ? 'arrow.right.from.bracket'
          : 'right.to.bracket'
      }
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
