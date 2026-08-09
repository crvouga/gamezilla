import { useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import { useEffect, useRef } from 'react';
import type { TextInput as RNTextInput } from 'react-native';

import { TextInput } from '../text-input';

export type CommandPaletteInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  editable: boolean;
  autoFocus?: boolean;
};

export function CommandPaletteInput({
  value,
  onChangeText,
  editable,
  autoFocus = true,
}: CommandPaletteInputProps) {
  const { t } = useLingui();
  const timers = useTimers();
  const inputRef = useRef<RNTextInput>(null);

  useEffect(() => {
    if (autoFocus && editable) {
      const timerId = timers.setTimeout(() => inputRef.current?.focus(), 50);
      return () => {
        timers.clearTimeout(timerId);
      };
    }
    return undefined;
  }, [autoFocus, editable, timers]);

  return (
    <TextInput
      ref={inputRef}
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      placeholder={t`Type a command or search…`}
      autoCorrect={false}
      autoCapitalize="none"
      clearButtonMode="while-editing"
    />
  );
}
