import { useAccountActions } from '@gamezilla/client/ui/use-account-actions';
import { ProfileScreen } from '@gamezilla/profile/client/profile-screen';

export default function ProfileTab() {
  const accountActions = useAccountActions();
  return <ProfileScreen accountActions={accountActions} />;
}
