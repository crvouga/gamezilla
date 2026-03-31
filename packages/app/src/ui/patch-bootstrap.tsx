import { assert } from '@gamezilla/shared/assert';
import { ConfigServiceToken } from '@gamezilla/shared/config/config-service';
import type { Container } from '@gamezilla/shared/dependency-injection/dependency-injection-container';
import { DependencyInjectionContainer } from '@gamezilla/shared/dependency-injection/dependency-injection-container';
import {
  ContainerProvider,
  useContainer,
  useDependency,
} from '@gamezilla/shared/dependency-injection/react';
import { useTheme } from '@gamezilla/shared/theme';
import { bootstrapPatchDbExpoSync } from '@gamezilla/patch-db/bootstrap-expo';
import { ThemedText } from '@/ui/themed-text';
import { ThemedView } from '@/ui/themed-view';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

export function PatchBootstrap({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [container, setContainer] = useState<Container | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const rawContainer = useContainer();
  assert.ok(
    rawContainer instanceof DependencyInjectionContainer,
    'PatchBootstrap must be rendered inside ConfigContainerProvider'
  );
  const configContainer = rawContainer;
  const configService = useDependency(ConfigServiceToken);

  const mountedRef = useRef(true);

  const runBootstrap = useCallback(() => {
    setError(null);
    bootstrapPatchDbExpoSync({
      apiUrl: configService.getString('PATCH_DB_SERVER_REQ_RES_URL'),
      parentContainer: configContainer,
    })
      .then(({ container: c }) => {
        if (mountedRef.current) setContainer(c);
      })
      .catch((err: unknown) => {
        console.error('[PatchBootstrap] Bootstrap failed:', err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });
  }, [configService, configContainer]);

  useEffect(() => {
    mountedRef.current = true;
    runBootstrap();
    return () => {
      mountedRef.current = false;
    };
  }, [runBootstrap]);

  if (error !== null) {
    return (
      <ThemedView
        style={theme.sx({
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 4,
          p: 4,
        })}
      >
        <ThemedText
          style={theme.sx({ fontSize: 16, textAlign: 'center' })}
          type="defaultSemiBold"
        >
          Failed to initialize
        </ThemedText>
        <ThemedText
          style={theme.sx({ fontSize: 14, opacity: 0.8, textAlign: 'center' })}
        >
          {error.message}
        </ThemedText>
        <Pressable
          onPress={runBootstrap}
          style={({ pressed }) => [
            theme.sx({
              mt: 4,
              py: 2.5,
              px: 4,
              borderRadius: 8,
              backgroundColor: 'tint',
            }),
            pressed && theme.sx({ opacity: 0.8 }),
          ]}
        >
          <ThemedText
            style={theme.sx({ color: 'paper' })}
            type="defaultSemiBold"
          >
            Retry
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (container === null) {
    return (
      <ThemedView
        style={theme.sx({
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 4,
        })}
      >
        <ActivityIndicator size="large" />
        <ThemedText style={theme.sx({ fontSize: 16 })}>
          Loading container...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
}
