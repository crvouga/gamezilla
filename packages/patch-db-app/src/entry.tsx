import { registerRootComponent } from 'expo';
import { assert } from '@gamezilla/shared/assert';
import { ExpoCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-expo';
import { ThemeProvider } from '@gamezilla/shared/ui';
import { PlaygroundApp } from './playground-app';

assert.registerCrashHandler(new ExpoCrashHandler());

function Root() {
  return (
    <ThemeProvider colorScheme="system" systemFallback="dark">
      <PlaygroundApp />
    </ThemeProvider>
  );
}

registerRootComponent(Root);
