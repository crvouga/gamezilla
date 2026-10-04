/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { AppLogo } from './app-logo';
import { ExampleRoot } from './example-root';
import { AppFrame } from './app-frame';
import {
  AppFrameChromeProvider,
  useSetAppFrameHeader,
} from './app-frame-chrome';

function OverrideDemo(): JSX.Element {
  useSetAppFrameHeader(
    <label class="text textLabel">
      {'Header override (space chrome slot)'}
    </label>
  );
  return <p class="text">{'Body under overridden AppFrame header.'}</p>;
}

export default function AppFrameExample(): JSX.Element {
  return (
    <ExampleRoot class="flex-1 min-h-80 gap-4">
      <AppFrameChromeProvider
        globalTrailing={<p class="text textCaption">{'Avatar'}</p>}
      >
        <AppFrame header={<AppLogo size={24} />}>
          <p class="text">{'AppFrame body (wide: centered max-width).'}</p>
        </AppFrame>
      </AppFrameChromeProvider>
      <AppFrameChromeProvider>
        <AppFrame header={<AppLogo size={24} />}>
          <OverrideDemo />
        </AppFrame>
      </AppFrameChromeProvider>
    </ExampleRoot>
  );
}
