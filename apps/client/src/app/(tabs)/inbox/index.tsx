import { AppHeaderLogo } from '@apps/client/ui/app-header/app-header-logo';
import { InboxScreen } from '@pkgs/inbox/client';

export default function InboxTab() {
  return <InboxScreen leading={<AppHeaderLogo />} />;
}
