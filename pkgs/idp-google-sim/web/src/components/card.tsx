/** Google's app-variant card: 448px, hairline outline, 28px corner. */

import type { JSX } from 'solid-js';

import { IDP_SCREEN_REGION_ID } from '../../../src/shared/screen-state';
import { FooterMeta } from './footer-meta';
import { GoogleLogo } from './google-logo';
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
      class="min-h-dvh bg-white font-gm text-base text-gm-on-surface"
      data-testid={props.testId}
    >
      <div class="mx-auto flex w-full max-w-[448px] flex-col px-6 pt-6 sm:px-8 sm:pt-12">
        <div class="flex h-10 items-center">
          <StepBack href={props.backHref} open={props.open} />
        </div>
        <GoogleLogo size={props.markSize} />
        <main
          id={IDP_SCREEN_REGION_ID}
          tabindex="-1"
          class="mt-6 flex flex-col gap-4 rounded-[28px] border border-gm-outline px-10 pt-12 pb-9 outline-none max-[600px]:mt-4 max-[600px]:rounded-none max-[600px]:border-0 max-[600px]:px-0 max-[600px]:pt-2 max-[600px]:pb-6"
        >
          {props.children}
        </main>
        <FooterMeta />
      </div>
    </div>
  );
}
