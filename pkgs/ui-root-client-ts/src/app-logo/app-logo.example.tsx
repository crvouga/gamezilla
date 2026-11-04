/** @jsxImportSource solid-js */

import { AppLogo } from '@pkgs/ui-root-client-ts/app-logo';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

export default function AppLogoExample(): JSX.Element {
  return (
    <ExampleRoot>
      <label class="text textLabel text-text-secondary">
        {'Mark + wordmark (default)'}
      </label>
      <SchemePreview>
        <div class="box flex-col gap-4">
          <AppLogo name="acme" />
          <AppLogo name="acme" size={36} />
          <AppLogo name="acme" size={48} />
        </div>
      </SchemePreview>

      <label class="text textLabel text-text-secondary">
        {'Configured artwork'}
      </label>
      <SchemePreview>
        <AppLogo
          name="acme"
          markSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='12' fill='gray'/%3E%3C/svg%3E"
        />
      </SchemePreview>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">{'Mark only'}</label>
      <SchemePreview>
        <div class="box flex-row gap-4 items-center">
          <AppLogo name="acme" size={20} wordmark={false} />
          <AppLogo name="acme" size={28} wordmark={false} />
          <AppLogo name="acme" size={48} wordmark={false} />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">
        {'Tinted overrides'}
      </label>
      <SchemePreview>
        <div class="box flex-col gap-3">
          <AppLogo name="acme" color="text" />
          <AppLogo name="acme" color="destructive" />
          <AppLogo name="acme" color="success" />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
