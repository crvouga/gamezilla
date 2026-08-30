import { useTimers } from '@pkgs/clock';
import * as Clipboard from 'expo-clipboard';
import { Component, type ReactNode, useState } from 'react';
import { DevSettings, Platform, Pressable, Text, View } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null };

const CRASH_TITLE = 'App crashed!';
const COPIED_RESET_MS = 2000;

function formatCrashText(error: Error): string {
  const message = String(error.message ?? error);
  const stack = String(error.stack ?? '');
  return stack.length > 0
    ? `${CRASH_TITLE}\n\n${message}\n\n${stack}`
    : `${CRASH_TITLE}\n\n${message}`;
}

function crashMessage(error: Error): string {
  const message = String(error.message ?? '').trim();
  return message.length > 0 ? message : String(error);
}

function reloadApp(): void {
  if (Platform.OS === 'web') {
    globalThis.location.reload();
    return;
  }
  DevSettings.reload();
}

type CrashButtonProps = {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  primary?: boolean;
};

function CrashButton({
  label,
  accessibilityLabel,
  onPress,
  primary = false,
}: CrashButtonProps): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: primary ? '#ffb4b4' : '#ff8a8a',
        backgroundColor: pressed
          ? primary
            ? '#4a2020'
            : '#3a1a1a'
          : primary
            ? '#3a1818'
            : '#2a1212',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: '#ff8a8a', fontSize: 14, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function CopyErrorButton({ error }: { error: Error }): ReactNode {
  const timers = useTimers();
  const [copied, setCopied] = useState(false);

  return (
    <CrashButton
      label={copied ? 'Copied' : 'Copy error'}
      accessibilityLabel="Copy error"
      onPress={() => {
        void Clipboard.setStringAsync(formatCrashText(error)).then(() => {
          setCopied(true);
          timers.setTimeout(() => setCopied(false), COPIED_RESET_MS);
        });
      }}
    />
  );
}

function RestartAppButton(): ReactNode {
  return (
    <CrashButton
      label="Restart"
      accessibilityLabel="Restart app"
      primary
      onPress={reloadApp}
    />
  );
}

/**
 * Last-resort boundary outside feature providers so a startup render throw
 * (e.g. a provider that calls `getApiBaseUrl()` / asserts) renders a readable
 * error instead of a blank white screen. Must sit under `SystemProvider` so the
 * fallback UI can use `useTimers`. Uses raw react-native primitives so it never
 * depends on the (possibly-crashing) theme/provider stack.
 */
export class RootErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#1b0d0d',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
          paddingVertical: 48,
        }}
      >
        <View style={{ alignItems: 'center', maxWidth: 420, width: '100%' }}>
          <Text
            selectable
            style={{
              color: '#ff8a8a',
              fontSize: 20,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            {CRASH_TITLE}
          </Text>
          <Text
            selectable
            style={{
              color: '#cdcdcd',
              fontSize: 15,
              textAlign: 'center',
              marginBottom: 20,
              lineHeight: 22,
            }}
          >
            {crashMessage(error)}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
            }}
          >
            <RestartAppButton />
            <CopyErrorButton error={error} />
          </View>
        </View>
      </View>
    );
  }
}
