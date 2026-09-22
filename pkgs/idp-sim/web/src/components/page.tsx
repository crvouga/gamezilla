/**
 * The screen shell: back arrow, brand lockup, a card that holds one step, and
 * a footer note that says what this is.
 *
 * Google stacks a bare mark above a wide card on white; this one names the
 * provider beside its mark and puts a design-system `Card` on the app
 * background — same information in the same order, different identity. The
 * footer carries no Help / Privacy / Terms: rendering dead links that look
 * like a real provider's is exactly the clone this screen is getting away
 * from.
 */

import { Card } from '@pkgs/ui/components/card';
import { IconLink } from '@pkgs/ui/components/icon-link';
import { ChevronLeftIcon } from '@pkgs/ui/components/icons';
import { Notice } from '@pkgs/ui/components/notice';
import { type JSX, Show } from 'solid-js';

import { IDP_BRAND } from '../../../src/shared/brand';
import { IDP_SCREEN_REGION_ID } from '../../../src/shared/screen-state';
import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import { BrandLockup } from './brand-mark';
import { useIdpProvider } from './ui-root';

/** Which real provider's behaviour this mock is reproducing — said plainly. */
const FLAVOR_NOTE = {
  google: 'Behaves like Google sign-in',
  apple: 'Behaves like Sign in with Apple',
} as const;

const BACK_ICON_SIZE = 20;

/** Back arrow; rendered only when there is a previous step to return to. */
function StepBack(props: {
  readonly href: string | null;
  /** Leaves the SPA for the provider's own `/back` document. */
  readonly open: (url: string) => void;
}) {
  return (
    <Show when={props.href}>
      {(href) => (
        <IconLink
          href={href()}
          label="Back"
          onClick={() => props.open(href())}
          dataSet={{ testid: IDP_TEST_IDS.back }}
        >
          <ChevronLeftIcon size={BACK_ICON_SIZE} color="text" />
        </IconLink>
      )}
    </Show>
  );
}

export function Page(props: {
  readonly testId: string;
  readonly backHref: string | null;
  readonly open: (url: string) => void;
  readonly markSize?: number | undefined;
  readonly children: JSX.Element;
}) {
  const provider = useIdpProvider();
  return (
    <div class="box min-h-dvh bg-background" data-testid={props.testId}>
      <div class="box mx-auto w-full max-w-[440px] px-4 pt-4 pb-8 sm:pt-10">
        <div class="box h-11 flex-row items-center -ml-2">
          <StepBack href={props.backHref} open={props.open} />
        </div>
        <div class="box mt-1 mb-5">
          <BrandLockup size={props.markSize} />
        </div>
        <Card as="main" id={IDP_SCREEN_REGION_ID} tabIndex={-1}>
          {props.children}
        </Card>
        <footer class="box mt-4">
          <Notice>
            {IDP_BRAND.name} — {IDP_BRAND.tagline}. {FLAVOR_NOTE[provider]}.
            Accounts and passwords here are local to this machine.
          </Notice>
        </footer>
      </div>
    </div>
  );
}

/** The screen's title and the line under it. */
export function PageHeading(props: {
  readonly id?: string | undefined;
  readonly title: JSX.Element;
  readonly subtitle?: JSX.Element | undefined;
}) {
  return (
    <div class="box gap-1">
      <h1 id={props.id} class="text textHeading">
        {props.title}
      </h1>
      <Show when={props.subtitle}>
        <p class="text text-text-secondary">{props.subtitle}</p>
      </Show>
    </div>
  );
}

/** A caption under a field; `id` is what the field's `aria-describedby` names. */
export function FieldHint(props: {
  readonly id: string;
  readonly children: JSX.Element;
}) {
  return (
    <p id={props.id} class="text textCaption">
      {props.children}
    </p>
  );
}
