import { Component, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null };

// eslint-disable-next-line lingui/no-unlocalized-strings -- last-resort crash screen, must not depend on the (possibly-crashed) i18n provider
const CRASH_TITLE = 'App failed to start';

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
