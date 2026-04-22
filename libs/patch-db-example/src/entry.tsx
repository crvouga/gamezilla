import { registerRootComponent } from 'expo';
import { assert } from '@gamezilla/shared/assert';
import { ExpoCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-expo';
import { ThemeProvider } from '@gamezilla/shared/ui';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { PlaygroundApp } from './playground-app';

assert.registerCrashHandler(new ExpoCrashHandler());

function Root() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider colorScheme="system" systemFallback="dark">
        <BottomSheetModalProvider>
          <PlaygroundApp />
        </BottomSheetModalProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

registerRootComponent(Root);
