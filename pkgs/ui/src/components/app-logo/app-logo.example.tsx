/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Divider } from '../divider';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { AppLogo } from './app-logo';

export default function AppLogoExample(): JSX.Element {
  return (
    <ExampleRoot>
      <label class="text textLabel text-text-secondary">
        {'Mark + wordmark (default)'}
      </label>
      <SchemePreview>
        <div class="box flex-col gap-4">
          <AppLogo />
          <AppLogo size={36} />
          <AppLogo size={48} />
        </div>
      </SchemePreview>

      <Divider />

      <label class="text textLabel text-text-secondary">{'Mark only'}</label>
      <SchemePreview>
        <div class="box flex-row gap-4 items-center">
          <AppLogo size={20} wordmark={false} />
          <AppLogo size={28} wordmark={false} />
          <AppLogo size={48} wordmark={false} />
        </div>
      </SchemePreview>

      <Divider />

      <label class="text textLabel text-text-secondary">
        {'Tinted overrides'}
      </label>
      <SchemePreview>
        <div class="box flex-col gap-3">
          <AppLogo color="text" />
          <AppLogo color="destructive" />
          <AppLogo color="success" />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
