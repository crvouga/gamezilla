import { registerRootComponent } from 'expo';
import { Assert } from '@gamezilla/shared/assert';
import { ExpoCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-expo';
import { ThemeProvider } from '@gamezilla/shared/ui';
import { App } from './app';

Assert.registerCrashHandler(new ExpoCrashHandler());

function Root() {
  return (
    <ThemeProvider colorScheme="system" systemFallback="dark">
      <App />
    </ThemeProvider>
  );
}

registerRootComponent(Root);
