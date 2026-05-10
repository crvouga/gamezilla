/**
 * Dismissible banner anchored to the top or bottom edge. Renders into
 * {@link DismissibleBannerPortalProvider}'s host (mount the provider once at app
 * root, inside {@link AppThemeRoot}).
 */

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { t } from '@lingui/core/macro';
import { assert } from '@gamezilla/lib/assert';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { Button } from '../button';
import { IconButton } from '../icon-button';
import { IconSymbol } from '../symbol-icon';
import { Text } from '../text';

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

function useSafeAreaInsetsCompat() {
  return useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
}

const EXIT_MS = 220;
const DEFAULT_SLIDE = 120;

/** RN Web often fails to apply transform animations with the native driver. */
const BANNER_SLIDE_USE_NATIVE_DRIVER = Platform.OS !== 'web';

export type DismissibleBannerPosition = 'top' | 'bottom';

function useBannerSlide(
  visible: boolean,
  layoutHeight: number,
  position: DismissibleBannerPosition,
  onDismiss: () => void
) {
  const sign = position === 'top' ? -1 : 1;
  const translateY = useRef(new Animated.Value(sign * DEFAULT_SLIDE)).current;
  const slideDistance = Math.max(layoutHeight, DEFAULT_SLIDE);
  const offscreen = sign * slideDistance;

  useEffect(() => {
    if (visible) {
      translateY.setValue(offscreen);
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 80,
        useNativeDriver: BANNER_SLIDE_USE_NATIVE_DRIVER,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: offscreen,
        duration: EXIT_MS,
        useNativeDriver: BANNER_SLIDE_USE_NATIVE_DRIVER,
      }).start();
    }
  }, [visible, layoutHeight, offscreen, translateY]);

  const dismiss = useCallback(() => {
    const d = sign * Math.max(layoutHeight, DEFAULT_SLIDE);
    Animated.timing(translateY, {
      toValue: d,
      duration: EXIT_MS,
      useNativeDriver: BANNER_SLIDE_USE_NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (finished) onDismiss();
    });
  }, [layoutHeight, onDismiss, sign, translateY]);

  return { translateY, dismiss };
}

type PortalEntry = readonly [string, ReactNode];
type PortalSnapshot = ReadonlyArray<PortalEntry>;

type PortalStore = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => PortalSnapshot;
  register: (id: string, node: ReactNode) => void;
  unregister: (id: string) => void;
};

const EMPTY_SNAPSHOT: PortalSnapshot = Object.freeze([]);

function createDismissibleBannerPortalStore(): PortalStore {
  let snapshot: PortalSnapshot = EMPTY_SNAPSHOT;
  const map = new Map<string, ReactNode>();
  const listeners = new Set<() => void>();

  const recompute = (): void => {
    snapshot = Object.freeze([...map.entries()]);
    listeners.forEach((l) => {
      l();
    });
  };

  return {
    subscribe: (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    getSnapshot: () => snapshot,
    register: (id, node) => {
      const existing = map.get(id);
      if (existing === node) return;
      map.set(id, node);
      recompute();
    },
    unregister: (id) => {
      if (map.delete(id)) {
        recompute();
      }
    },
  };
}

export type DismissibleBannerPortalApi = {
  register: (id: string, node: ReactNode) => void;
  unregister: (id: string) => void;
};

const DismissibleBannerPortalContext =
  createContext<DismissibleBannerPortalApi | null>(null);

/** Full-screen overlay; web uses fixed + fill (RN Web types omit `position: 'fixed'`). */
const DISMISSIBLE_BANNER_PORTAL_HOST_STYLE: StyleProp<ViewStyle> =
  Platform.OS === 'web'
    ? [
        StyleSheet.absoluteFill,
        { zIndex: 999_999 },
        {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        } as unknown as ViewStyle,
      ]
    : [StyleSheet.absoluteFill, { zIndex: 999_999 }];

function DismissibleBannerPortalHost({ store }: { store: PortalStore }) {
  const entries = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
  return (
    <View
      pointerEvents="box-none"
      style={DISMISSIBLE_BANNER_PORTAL_HOST_STYLE}
      collapsable={false}
    >
      {entries.map(([key, value]) => (
        <Fragment key={key}>{value}</Fragment>
      ))}
    </View>
  );
}

export type DismissibleBannerPortalProviderProps = {
  children: ReactNode;
};

export function DismissibleBannerPortalProvider({
  children,
}: DismissibleBannerPortalProviderProps) {
  const store = useMemo(() => createDismissibleBannerPortalStore(), []);
  const api = useMemo(
    (): DismissibleBannerPortalApi => ({
      register: store.register,
      unregister: store.unregister,
    }),
    [store]
  );

  return (
    <DismissibleBannerPortalContext.Provider value={api}>
      <View style={{ flex: 1 }} collapsable={false}>
        {children}
        <DismissibleBannerPortalHost store={store} />
      </View>
    </DismissibleBannerPortalContext.Provider>
  );
}

const MISSING_PORTAL_MSG =
  'DismissibleBanner requires DismissibleBannerPortalProvider at the app root. Wrap your app inside AppThemeRoot with <DismissibleBannerPortalProvider>…</DismissibleBannerPortalProvider>.';

function DismissibleBannerPromptBody({
  title,
  subtitle,
  actionLabel,
  onActionPress,
}: {
  title: ReactNode;
  subtitle: ReactNode | undefined;
  actionLabel: ReactNode | undefined;
  onActionPress: (() => void) | undefined;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 120, gap: 1 }}>
        <Text variant="bodyBold" label={title} />
        {subtitle !== undefined && subtitle !== null ? (
          <Text variant="caption" label={subtitle} />
        ) : null}
      </Box>
      {actionLabel !== undefined &&
      actionLabel !== null &&
      onActionPress !== undefined ? (
        <Button title={actionLabel} onPress={onActionPress} />
      ) : null}
    </Box>
  );
}

export type DismissibleBannerProps = {
  visible: boolean;
  /** Called after the dismiss control’s exit animation finishes. */
  onDismiss: () => void;
  /** Primary prompt line. */
  title: ReactNode;
  /** Optional secondary line under the title. */
  subtitle?: ReactNode;
  /** Label for a single optional action control (requires {@link onActionPress}). */
  actionLabel?: ReactNode;
  /** Handler for {@link actionLabel}. */
  onActionPress?: () => void;
  /** Edge the banner attaches to; also controls slide direction and safe-area padding. */
  position?: DismissibleBannerPosition;
  testID?: string;
  dismissButtonTestID?: string;
};

type DismissibleBannerFrameProps = {
  position: DismissibleBannerPosition;
  insets: { top: number; bottom: number };
  setLayoutHeight: Dispatch<SetStateAction<number>>;
  title: ReactNode;
  subtitle: ReactNode | undefined;
  actionLabel: ReactNode | undefined;
  onActionPress: (() => void) | undefined;
  dismiss: () => void;
  theme: ReturnType<typeof useTheme>;
  dismissButtonTestID: string | undefined;
};

function DismissibleBannerFrame({
  position,
  insets,
  setLayoutHeight,
  title,
  subtitle,
  actionLabel,
  onActionPress,
  dismiss,
  theme,
  dismissButtonTestID,
}: DismissibleBannerFrameProps) {
  const paddingSx =
    position === 'top'
      ? {
          paddingTop: insets.top,
          paddingBottom: 3,
          borderBottomWidth: 1,
        }
      : {
          paddingBottom: insets.bottom,
          paddingTop: 3,
          borderTopWidth: 1,
        };

  return (
    <Box
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        setLayoutHeight((prev) => (h !== prev ? h : prev));
      }}
      sx={{
        paddingLeft: 4,
        paddingRight: 4,
        background: 'surface',
        borderColor: 'border',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        ...paddingSx,
      }}
    >
      <DismissibleBannerPromptBody
        title={title}
        subtitle={subtitle}
        actionLabel={actionLabel}
        onActionPress={onActionPress}
      />
      <IconButton
        size={40}
        onPress={dismiss}
        accessibilityLabel={t`Dismiss`}
        {...(dismissButtonTestID !== undefined
          ? { testID: dismissButtonTestID }
          : {})}
      >
        <IconSymbol name="xmark" size={20} color={theme.colors.icon} />
      </IconButton>
    </Box>
  );
}

function dismissibleBannerPortalNode({
  position,
  translateY,
  testID,
  insets,
  setLayoutHeight,
  dismiss,
  theme,
  dismissButtonTestID,
  title,
  subtitle,
  actionLabel,
  onActionPress,
}: {
  position: DismissibleBannerPosition;
  translateY: Animated.Value;
  testID: string | undefined;
  insets: { top: number; bottom: number };
  setLayoutHeight: Dispatch<SetStateAction<number>>;
  dismiss: () => void;
  theme: ReturnType<typeof useTheme>;
  dismissButtonTestID: string | undefined;
  title: ReactNode;
  subtitle: ReactNode | undefined;
  actionLabel: ReactNode | undefined;
  onActionPress: (() => void) | undefined;
}) {
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          zIndex: 9999,
          transform: [{ translateY }],
        },
        position === 'top'
          ? { top: 0, left: 0, right: 0 }
          : { bottom: 0, left: 0, right: 0 },
      ]}
      testID={testID}
    >
      <DismissibleBannerFrame
        position={position}
        insets={insets}
        setLayoutHeight={setLayoutHeight}
        title={title}
        subtitle={subtitle}
        actionLabel={actionLabel}
        onActionPress={onActionPress}
        dismiss={dismiss}
        theme={theme}
        dismissButtonTestID={dismissButtonTestID}
      />
    </Animated.View>
  );
}

function useDismissibleBannerPortalRegistration(
  portal: DismissibleBannerPortalApi | null,
  portalId: string,
  node: ReactNode
): void {
  useLayoutEffect(() => {
    if (portal === null) return;
    portal.register(portalId, node);
    return () => {
      portal.unregister(portalId);
    };
  }, [portal, portalId, node]);
}

function DismissibleBannerPortaled({
  portal,
  portalId,
  visible,
  onDismiss,
  title,
  subtitle,
  actionLabel,
  onActionPress,
  position = 'top',
  testID,
  dismissButtonTestID,
}: DismissibleBannerProps & {
  portal: DismissibleBannerPortalApi | null;
  portalId: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsetsCompat();
  const [layoutHeight, setLayoutHeight] = useState(0);
  const { translateY, dismiss } = useBannerSlide(
    visible,
    layoutHeight,
    position,
    onDismiss
  );

  const node = useMemo(
    () =>
      dismissibleBannerPortalNode({
        position,
        translateY,
        testID,
        insets: { top: insets.top, bottom: insets.bottom },
        setLayoutHeight,
        dismiss,
        theme,
        dismissButtonTestID,
        title,
        subtitle,
        actionLabel,
        onActionPress,
      }),
    [
      actionLabel,
      dismiss,
      dismissButtonTestID,
      insets.bottom,
      insets.top,
      onActionPress,
      position,
      subtitle,
      testID,
      theme,
      title,
      translateY,
    ]
  );

  useDismissibleBannerPortalRegistration(portal, portalId, node);

  if (portal === null) {
    assert.ok(!visible, MISSING_PORTAL_MSG, { visible });
    return null;
  }

  return null;
}

export function DismissibleBanner(props: DismissibleBannerProps) {
  const portal = useContext(DismissibleBannerPortalContext);
  const rawId = useId();
  const portalId = rawId.replace(/:/g, '');
  return (
    <DismissibleBannerPortaled portal={portal} portalId={portalId} {...props} />
  );
}
