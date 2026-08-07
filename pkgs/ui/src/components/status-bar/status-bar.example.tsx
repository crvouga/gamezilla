import { useState } from 'react';
import { Button } from '../button';
import { ExampleRoot } from '../explorer/example-root';
import { SoundIndicator } from '../sound-indicator';
import { Stack } from '../stack';
import { StatusDot } from '../status-dot';
import { Switch } from '../switch';
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
        title="Connectivity"
        caption="Network reachability"
        accessibilityLabel="Online"
        indicator={<StatusDot status="online" size={8} />}
        leading={<StatusDot status="online" size={12} />}
        panel={<Text variant="body" label="Connected to the demo network." />}
      />
      <RegisterStatusBarItem
        id="demo-sound"
        order={20}
        title="Sound"
        caption={muted ? 'Muted' : 'On'}
        accessibilityLabel={muted ? 'Sound muted' : 'Sound on'}
        indicator={
          <SoundIndicator state={muted ? 'muted' : 'idle'} size={12} />
        }
        panel={<Switch label="Mute" value={muted} onValueChange={setMuted} />}
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
