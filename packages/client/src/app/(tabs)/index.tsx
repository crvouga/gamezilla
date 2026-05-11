import { useAccountActions } from '@gamezilla/client/ui/use-account-actions';
import { SpacesScreen } from '@gamezilla/spaces/client/spaces-screen';

export default function SpacesTab() {
  const accountActions = useAccountActions();
  return <SpacesScreen accountActions={accountActions} />;
}
