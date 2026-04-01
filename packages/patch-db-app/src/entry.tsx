import { registerRootComponent } from 'expo';
import { assert } from '@gamezilla/shared/assert';
import { ExpoCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-expo';
import { ThemeProvider } from '@gamezilla/shared/ui';
import { useColorScheme } from 'react-native';
import { PlaygroundApp } from './playground-app';

assert.registerCrashHandler(new ExpoCrashHandler());

function Root() {
  const colorScheme = useColorScheme() ?? 'dark';
  return (
    <ThemeProvider colorScheme={colorScheme}>
      <PlaygroundApp />
    </ThemeProvider>
  );
}

registerRootComponent(Root);
