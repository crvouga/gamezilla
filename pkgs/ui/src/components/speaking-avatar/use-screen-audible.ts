import { NavigationContext } from '@react-navigation/native';
import { useContext, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * True when the nearest navigation route is focused (or there is no
 * navigation context) and the app is in the foreground (`AppState`
 * `'active'`). Used to gate TTS so speech does not start or continue after
 * navigate-away or backgrounding.
 *
 * Outside a navigator (explorer / tests), focus defaults to `true` so
 * decorative mounts still work; callers can mute via `speak={false}`.
 */
export function useScreenAudible(): boolean {
  const navigation = useContext(NavigationContext);
  const [isFocused, setIsFocused] = useState(
    () => navigation?.isFocused() ?? true
  );
  const [appActive, setAppActive] = useState(
    () => AppState.currentState === 'active'
  );

  useEffect(() => {
    if (navigation === null || navigation === undefined) {
      setIsFocused(true);
      return;
    }
    setIsFocused(navigation.isFocused());
    const unsubFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
    });
    const unsubBlur = navigation.addListener('blur', () => {
      setIsFocused(false);
    });
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  useEffect(() => {
    const onChange = (state: AppStateStatus): void => {
      setAppActive(state === 'active');
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return isFocused && appActive;
}
