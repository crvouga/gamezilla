import { useTimers } from '@pkgs/clock';
import type { LocalizedString } from '@pkgs/i18n';
import { useEffect, useRef } from 'react';
import type { TextInput as RNTextInput } from 'react-native';

import { Box } from '../box';
import { TextInput } from '../text-input';

export function ComboboxSearch({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  activeDescendantId,
  onKeyDown,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: LocalizedString;
  autoFocus: boolean;
  activeDescendantId: string | undefined;
  onKeyDown:
    | ((event: { key: string; preventDefault: () => void }) => void)
    | undefined;
}) {
  const timers = useTimers();
  const inputRef = useRef<RNTextInput>(null);

  useEffect(() => {
    if (!autoFocus) return undefined;
    const timerId = timers.setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      timers.clearTimeout(timerId);
    };
  }, [autoFocus, timers]);

  return (
    <Box sx={{ px: 0, pb: 2 }}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        {...(activeDescendantId !== undefined
          ? { 'aria-activedescendant': activeDescendantId }
          : {})}
        onKeyPress={
          onKeyDown === undefined
            ? undefined
            : (e) => {
                onKeyDown({
                  key: e.nativeEvent.key,
                  preventDefault: () => {
                    e.preventDefault?.();
                  },
                });
              }
        }
      />
    </Box>
  );
}
