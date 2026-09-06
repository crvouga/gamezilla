import { AppLogo } from '../app-logo';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { AppFrame } from './app-frame';
import {
  AppFrameChromeProvider,
  useSetAppFrameHeader,
} from './app-frame-chrome';

function OverrideDemo() {
  useSetAppFrameHeader(
    <Text variant="label" label="Header override (space chrome slot)" />
  );
  return <Text variant="body" label="Body under overridden AppFrame header." />;
}

export default function AppFrameExample() {
  return (
    <ExampleRoot sx={{ flex: 1, minHeight: 320, gap: 4 }}>
      <AppFrameChromeProvider
        globalTrailing={<Text variant="caption" label="Avatar" />}
      >
        <AppFrame header={<AppLogo size={24} />}>
          <Text
            variant="body"
            label="AppFrame body (wide: centered max-width)."
          />
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
