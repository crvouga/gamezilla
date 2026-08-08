import { useState } from 'react';
import { Button } from '../button';
import { ExampleRoot } from '../explorer/example-root';
import { SoundIndicator } from '../sound-indicator';
import { Stack } from '../stack';
import { StatusDot } from '../status-dot';
import { Text } from '../text';
import {
  RegisterStatusBarItem,
  StatusBar,
  StatusBarRegistryProvider,
  useStatusBar,
} from './index';

function OpenStatusBarButton() {
  const { open } = useStatusBar();
  return <Button title="Open status panel" onPress={open} />;
}

function DemoItems() {
  const [muted, setMuted] = useState(false);
  return (
    <>
      <RegisterStatusBarItem
        id="demo-online"
        order={10}
        title="Online"
        caption="Connected"
        accessibilityLabel="Online"
        active
        indicator={<StatusDot status="online" size={8} />}
        leading={<StatusDot status="online" size={14} />}
        onPress={() => undefined}
      />
      <RegisterStatusBarItem
        id="demo-sound"
        order={20}
        title="Sound"
        caption={muted ? 'Muted' : 'On'}
        accessibilityLabel={muted ? 'Sound muted' : 'Sound on'}
        active={!muted}
        contentKey={muted}
        indicator={
          <SoundIndicator state={muted ? 'muted' : 'idle'} size={12} />
        }
        leading={
          <SoundIndicator
            state={muted ? 'muted' : 'idle'}
            size={18}
            backgroundColor="transparent"
          />
        }
        onPress={() => setMuted((value) => !value)}
      />
    </>
  );
}

export default function StatusBarExample() {
  return (
    <ExampleRoot>
      <StatusBarRegistryProvider>
        <DemoItems />
        <Stack spacing={3} sx={{ flex: 1 }}>
          <StatusBar panelTitle="Status" />
          <Text
            variant="body"
            label="Swipe down on the strip to open. Close with the top-right button or the bottom grabber."
          />
          <OpenStatusBarButton />
        </Stack>
      </StatusBarRegistryProvider>
    </ExampleRoot>
  );
}
