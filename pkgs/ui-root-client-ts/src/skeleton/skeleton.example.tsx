/** @jsxImportSource solid-js */

import { Skeleton, SkeletonContent } from '@pkgs/ui-root-client-ts/skeleton';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

function SectionLabel(props: { label: string }): JSX.Element {
  return <p class="text textSectionLabel">{props.label}</p>;
}

export default function SkeletonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <SectionLabel label='Rows (variant="rows")' />
        <SkeletonContent variant="rows" />

        <SectionLabel label='Avatar and text (variant="avatarText")' />
        <SkeletonContent variant="avatarText" count={4} />

        <SectionLabel label='Tiles (variant="tiles")' />
        <SkeletonContent variant="tiles" />

        <SectionLabel label='Board (variant="board")' />
        <div class="box w-full max-w-ui-prose">
          <SkeletonContent variant="board" />
        </div>
      </SchemePreview>

      <SchemePreview>
        <SectionLabel label="Single pieces" />
        <div class="box flex-col gap-2">
          <Skeleton width="80%" height={16} />
          <Skeleton width="100%" height={16} />
          <Skeleton width="60%" height={16} />
        </div>
        <div class="box flex-row gap-3 items-center">
          <Skeleton width={48} height={48} shape="circle" />
          <Skeleton width="50%" height={16} />
        </div>
        <Skeleton width="100%" height={160} shape="rect" />
      </SchemePreview>
    </ExampleRoot>
  );
}
