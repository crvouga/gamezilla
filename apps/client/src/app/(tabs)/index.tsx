import { AppAccountMenu } from '@apps/client/ui/app-header/app-account-menu';
import { AppHeaderLogo } from '@apps/client/ui/app-header/app-header-logo';
import { AppHeaderTabs } from '@apps/client/ui/app-header/app-header-tabs';
import { useAccountActions } from '@apps/client/ui/use-account-actions';
import { SpacesScreen } from '@libs/spaces/client/spaces-screen';

export default function SpacesTab() {
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b580fa'},body:JSON.stringify({sessionId:'b580fa',location:'(tabs)/index.tsx:SpacesTab:render',message:'SpacesTab render',hypothesisId:'H8',timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const accountActions = useAccountActions();
  return (
    <SpacesScreen
      accountActions={accountActions}
      leading={<AppHeaderLogo />}
      centerTabs={<AppHeaderTabs />}
      headerEnd={<AppAccountMenu />}
    />
  );
}
