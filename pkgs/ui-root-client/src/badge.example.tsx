/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Badge } from './badge';
import { ExampleRoot } from './example-root';
import { SchemePreview } from './scheme-preview';

export default function BadgeExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <div class="box flex-col gap-3">
          <label class="text textFootnote">{'Subtle (default)'}</label>
          <div class="box flex-row gap-2 flex-wrap">
            <Badge label="Brand" intent="brand" />
            <Badge label="Success" intent="success" />
            <Badge label="Warning" intent="warning" />
            <Badge label="Destructive" intent="destructive" />
            <Badge label="Info" intent="info" />
            <Badge label="Neutral" intent="neutral" />
          </div>

          <label class="text textFootnote">{'Solid'}</label>
          <div class="box flex-row gap-2 flex-wrap">
            <Badge label="Brand" intent="brand" tone="solid" />
            <Badge label="Success" intent="success" tone="solid" />
            <Badge label="Warning" intent="warning" tone="solid" />
            <Badge label="Destructive" intent="destructive" tone="solid" />
            <Badge label="Info" intent="info" tone="solid" />
            <Badge label="Neutral" intent="neutral" tone="solid" />
          </div>

          <label class="text textFootnote">{'Sizes'}</label>
          <div class="box flex-row gap-2 items-center">
            <Badge label="3" intent="destructive" size="sm" />
            <Badge label="99+" intent="brand" size="sm" />
            <Badge label="New" intent="success" />
            <Badge label="Updated" intent="info" />
          </div>

          <label class="text textFootnote">
            {'Notification count (brand solid)'}
          </label>
          <div class="box flex-row gap-2 items-center">
            <Badge label="1" intent="brand" tone="solid" size="sm" />
            <Badge label="12" intent="brand" tone="solid" size="sm" />
            <Badge label="99+" intent="brand" tone="solid" size="sm" />
          </div>
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
