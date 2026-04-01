import { registerRootComponent } from 'expo';
import { Assert } from '@gamezilla/shared/assert';
import { ExpoCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-expo';
import { ThemeProvider } from '@gamezilla/shared/ui';
import { useColorScheme } from 'react-native';
import { App } from './app';

Assert.registerCrashHandler(new ExpoCrashHandler());

function Root() {
  const colorScheme = useColorScheme() ?? 'dark';
  return (
    <ThemeProvider colorScheme={colorScheme}>
      <App />
    </ThemeProvider>
  );
}

registerRootComponent(Root);
