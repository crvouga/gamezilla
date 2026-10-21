/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { SchemePreview } from './scheme-preview';
import { Skeleton } from './skeleton';

export default function SkeletonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <div class="box flex-col gap-2">
          <label class="text textCaption">{'Text lines (shape="text")'}</label>
          <Skeleton width="80%" height={16} />
          <Skeleton width="100%" height={16} />
          <Skeleton width="60%" height={16} />
        </div>

        <label class="text textCaption">
          {'Row placeholder (circle + text)'}
        </label>
        <div class="panel p-4">
          <div class="box flex-row gap-3 items-center">
            <Skeleton width={48} height={48} shape="circle" />
            <div class="box flex-col gap-2 flex-1">
              <Skeleton width="50%" height={16} />
              <Skeleton width="80%" height={12} />
            </div>
          </div>
        </div>

        <label class="text textCaption">{'Media (shape="rect")'}</label>
        <Skeleton width="100%" height={160} shape="rect" />
      </SchemePreview>
    </ExampleRoot>
  );
}
