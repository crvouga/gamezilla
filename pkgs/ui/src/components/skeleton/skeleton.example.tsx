/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Skeleton } from './skeleton';

export default function SkeletonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box flex-col gap-2">
        <label class="text textLabel">{'Text lines'}</label>
        <Skeleton width="80%" height={16} />
        <Skeleton width="100%" height={16} />
        <Skeleton width="60%" height={16} />
      </div>

      <label class="text textLabel">{'Card placeholder'}</label>
      <div class="card p-4">
        <div class="box flex-row gap-3 items-center">
          <Skeleton width={48} height={48} borderRadius={24} />
          <div class="box flex-col gap-2 flex-1">
            <Skeleton width="50%" height={14} />
            <Skeleton width="80%" height={12} />
          </div>
        </div>
      </div>
    </ExampleRoot>
  );
}
