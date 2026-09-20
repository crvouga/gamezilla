/**
 * The screen shell: brand lockup, a card that holds one step, and the footer.
 *
 * Google stacks a bare mark above a 448px / 28px-radius card on white. This
 * one sits a narrower card on a tinted page with its own radius and a lockup
 * that names the provider — same information in the same order, different
 * identity.
 */

import type { JSX } from 'solid-js';

import { IDP_SCREEN_REGION_ID } from '../../../src/shared/screen-state';
import { BrandLockup } from './brand-mark';
import { FooterMeta } from './footer-meta';
import { StepBack } from './step-back';

export function Card(props: {
  readonly testId: string;
  readonly backHref: string | null;
  readonly open: (url: string) => void;
  readonly markSize?: number | undefined;
  readonly children: JSX.Element;
}) {
  return (
    <div
      class="min-h-dvh bg-idp-page font-idp text-base text-idp-on-surface"
      data-testid={props.testId}
    >
      <div class="mx-auto flex w-full max-w-[420px] flex-col px-5 pt-6 sm:pt-12">
        <div class="flex h-8 items-center">
          <StepBack href={props.backHref} open={props.open} />
        </div>
        <div class="mt-1 mb-5">
          <BrandLockup size={props.markSize} />
        </div>
        <main
          id={IDP_SCREEN_REGION_ID}
          tabindex="-1"
          class="flex flex-col gap-4 rounded-2xl border border-idp-divider bg-idp-surface px-8 pt-8 pb-7 shadow-sm outline-none max-[600px]:rounded-xl max-[600px]:px-5 max-[600px]:pt-6 max-[600px]:pb-6"
        >
          {props.children}
        </main>
        <FooterMeta />
      </div>
    </div>
  );
}
