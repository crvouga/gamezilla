/** The refusal: an untrustworthy request never gets a form. */

import type { IdpScreenStateOf } from '../../../src/shared/screen-state';
import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import { IDP_MARK_ERROR_SIZE } from '../components/brand-mark';
import { Card } from '../components/card';

export function ErrorScreen(props: {
  readonly state: IdpScreenStateOf<'error'>;
}) {
  return (
    <Card
      testId={IDP_TEST_IDS.errorPage}
      backHref={null}
      open={() => undefined}
      markSize={IDP_MARK_ERROR_SIZE}
    >
      <h1 class="text-2xl leading-8 font-normal">
        Error {props.state.status}: {props.state.error}
      </h1>
      <p class="text-base text-idp-on-surface-variant">{props.state.detail}</p>
      <p class="text-xs text-idp-on-surface-variant">
        You can't sign in because this app sent an invalid request. You can try
        again later, or contact the developer about this issue.
      </p>
    </Card>
  );
}
