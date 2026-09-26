/** The refusal: an untrustworthy request never gets a form. */

import type { IdpScreenStateOf } from '../../../src/shared/screen-state';
import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import { IDP_MARK_ERROR_SIZE } from '../components/brand-mark';
import { Page, PageHeading } from '../components/page';

export function ErrorScreen(props: {
  readonly state: IdpScreenStateOf<'error'>;
}) {
  return (
    <Page
      testId={IDP_TEST_IDS.errorPage}
      backHref={null}
      open={() => undefined}
      markSize={IDP_MARK_ERROR_SIZE}
    >
      <PageHeading
        title={`Error ${String(props.state.status)}: ${props.state.error}`}
        subtitle={props.state.detail}
      />
      <p class="text textCaption">
        You can't sign in because this app sent an invalid request. You can try
        again later, or contact the developer about this issue.
      </p>
    </Page>
  );
}
