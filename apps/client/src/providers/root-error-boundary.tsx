import * as Clipboard from 'expo-clipboard';
import { Component, type ReactNode, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null };

const CRASH_TITLE = 'App failed to start';
const COPIED_RESET_MS = 2000;

function formatCrashText(error: Error): string {
  const message = String(error.message ?? error);
  const stack = String(error.stack ?? '');
  return stack.length > 0
    ? `${CRASH_TITLE}\n\n${message}\n\n${stack}`
    : `${CRASH_TITLE}\n\n${message}`;
}

function CopyErrorButton({ error }: { error: Error }): ReactNode {
  const [copied, setCopied] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Copy error"
      onPress={() => {
        void Clipboard.setStringAsync(formatCrashText(error)).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), COPIED_RESET_MS);
        });
      }}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ff8a8a',
        backgroundColor: pressed ? '#3a1a1a' : '#2a1212',
        marginBottom: 16,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: '#ff8a8a', fontSize: 14, fontWeight: '600' }}>
        {copied ? 'Copied' : 'Copy error'}
      </Text>
    </Pressable>
  );
}

/**
 * Last-resort boundary OUTSIDE every app provider so a startup render throw
 * (e.g. a provider that calls `getApiBaseUrl()` / asserts) renders a readable
 * error instead of a blank white screen. Uses raw react-native primitives so
 * it never depends on the (possibly-crashing) theme/provider stack.
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
      <ScrollView
        style={{ flex: 1, backgroundColor: '#1b0d0d' }}
        contentContainerStyle={{ padding: 24, paddingTop: 72 }}
      >
        <View>
          <Text
            style={{
              color: '#ff8a8a',
              fontSize: 20,
              fontWeight: '700',
              marginBottom: 12,
            }}
          >
            {CRASH_TITLE}
          </Text>
          <CopyErrorButton error={error} />
          <Text
            selectable
            style={{ color: '#ffffff', fontSize: 15, marginBottom: 16 }}
          >
            {String(error?.message ?? error)}
          </Text>
          <Text selectable style={{ color: '#cdcdcd', fontSize: 12 }}>
            {String(error?.stack ?? '')}
          </Text>
        </View>
      </ScrollView>
    );
  }
}
