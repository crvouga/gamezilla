import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable as RNPressable,
  View,
} from 'react-native';

import { borderRadius } from '../../theme/scale';
import { Box } from '../box';
import { FlatList } from '../flat-list';
import { ModalRoot } from '../modal/modal-root';
import { ProgressBar } from '../progress-bar';
import { Text } from '../text';
import { buildPaletteRows, type PaletteRow } from './build-palette-rows';
import { CommandPaletteEmpty } from './command-palette-empty';
import { CommandPaletteInput } from './command-palette-input';
import { CommandPaletteItem } from './command-palette-item';
import { useCommandRegistry } from './command-registry-context';

const LIST_MAX_HEIGHT = 320;

export type CommandPaletteProps = {
  /** Hint shown under the list (e.g. keyboard shortcuts). */
  footerLegend?: string;
};

export function CommandPalette({ footerLegend }: CommandPaletteProps) {
  const {
    store,
    historyStore,
    isOpen,
    close,
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    runningId,
    getError,
    invoke,
  } = useCommandRegistry();

  /** Safe-area is app-specific; offset below typical status bar. */
  const topInset = 12;
  const [, setStoreTick] = useState(0);
  const [, setHistoryTick] = useState(0);

  useEffect(() => {
    return store.subscribe(() => setStoreTick((n) => n + 1));
  }, [store]);

  useEffect(() => {
    return historyStore.subscribe(() => setHistoryTick((n) => n + 1));
  }, [historyStore]);

  const commands = store.getAll();
  const historyIds = historyStore.getIds();

  const { rows, selectableCount } = useMemo(
    () => buildPaletteRows(commands, query, historyIds),
    [commands, query, historyIds]
  );

  const itemRows = useMemo(
    () =>
      rows.filter(
        (r): r is Extract<PaletteRow, { kind: 'item' }> => r.kind === 'item'
      ),
    [rows]
  );

  useEffect(() => {
    if (selectedIndex >= selectableCount && selectableCount > 0) {
      setSelectedIndex(selectableCount - 1);
    }
    if (selectableCount === 0) {
      setSelectedIndex(0);
    }
  }, [selectableCount, selectedIndex, setSelectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, setSelectedIndex]);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(-8);
    }
  }, [isOpen, opacity, translateY]);

  const flatListRef = useRef<import('react-native').FlatList<PaletteRow>>(null);

  useEffect(() => {
    if (!isOpen || itemRows.length === 0) {
      return;
    }
    const idx = rows.findIndex(
      (r) => r.kind === 'item' && r.key === itemRows[selectedIndex]?.key
    );
    if (idx >= 0) {
      try {
        flatListRef.current?.scrollToIndex({ index: idx, viewPosition: 0.4 });
      } catch {
        // ignore scroll errors before layout
      }
    }
  }, [isOpen, itemRows, rows, selectedIndex]);

  const onKeyNavigation = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || runningId !== null) {
        return;
      }
      const n = itemRows.length;
      if (n === 0) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % n);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + n) % n);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = itemRows[selectedIndex]?.command;
        if (cmd !== undefined) {
          void invoke(cmd.id);
        }
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          setSelectedIndex((i) => (i - 1 + n) % n);
        } else {
          setSelectedIndex((i) => (i + 1) % n);
        }
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        setSelectedIndex(0);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        setSelectedIndex(n - 1);
        return;
      }
    },
    [
      close,
      invoke,
      isOpen,
      itemRows,
      runningId,
      selectedIndex,
      setSelectedIndex,
    ]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen) {
      return;
    }
    const onDown = (ev: KeyboardEvent) => {
      onKeyNavigation(ev);
    };
    window.addEventListener('keydown', onDown, true);
    return () => window.removeEventListener('keydown', onDown, true);
  }, [isOpen, onKeyNavigation]);

  return (
    <ModalRoot visible={isOpen} onRequestClose={close}>
      <View style={{ flex: 1 }}>
        <RNPressable
          accessibilityLabel="Dismiss command palette"
          onPress={close}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        />
        <View
          style={{
            position: 'absolute',
            top: topInset + 48,
            left: 0,
            right: 0,
            alignItems: 'center',
            paddingHorizontal: 16,
            pointerEvents: 'box-none',
          }}
        >
          <Animated.View
            style={{
              width: '100%',
              maxWidth: 560,
              opacity,
              transform: [{ translateY }],
            }}
          >
            <Box
              sx={{
                background: 'surface',
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: 'border',
                overflow: 'hidden',
                boxShadow: '0px 12px 32px rgba(0, 0, 0, 0.18)',
                elevation: 12,
              }}
            >
              {runningId !== null ? (
                <ProgressBar indeterminate height={2} color="tint" />
              ) : (
                <View style={{ height: 2 }} />
              )}

              <Box sx={{ px: 3, pt: 2, pb: 2 }}>
                <CommandPaletteInput
                  value={query}
                  onChangeText={setQuery}
                  editable={runningId === null}
                  autoFocus={isOpen}
                />
              </Box>

              {rows.length === 0 ? (
                <CommandPaletteEmpty />
              ) : (
                <FlatList
                  ref={flatListRef}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: LIST_MAX_HEIGHT }}
                  data={rows}
                  keyExtractor={(item) => item.key}
                  onScrollToIndexFailed={({ index }) => {
                    setTimeout(() => {
                      flatListRef.current?.scrollToIndex({
                        index,
                        viewPosition: 0.4,
                      });
                    }, 100);
                  }}
                  renderItem={({ item }) => {
                    if (item.kind === 'header') {
                      return (
                        <Box sx={{ px: 3, py: 2, background: 'background' }}>
                          <Text
                            variant="label"
                            sx={{ color: 'textSecondary', letterSpacing: 0.5 }}
                            label={item.title}
                          />
                        </Box>
                      );
                    }
                    const idx = itemRows.findIndex((ir) => ir.key === item.key);
                    const selected = idx === selectedIndex;
                    const running = runningId === item.command.id;
                    return (
                      <CommandPaletteItem
                        command={item.command}
                        query={query}
                        selected={selected}
                        running={running}
                        error={getError(item.command.id)}
                        onSelect={() => {
                          if (runningId === null) {
                            void invoke(item.command.id);
                          }
                        }}
                      />
                    );
                  }}
                />
              )}

              {footerLegend !== undefined ? (
                <Box sx={{ px: 3, pb: 2, pt: 1 }}>
                  <Text
                    variant="caption"
                    sx={{ color: 'textSecondary' }}
                    label={footerLegend}
                  />
                </Box>
              ) : (
                <Box sx={{ px: 3, pb: 2, pt: 1 }}>
                  <Text
                    variant="caption"
                    sx={{ color: 'textSecondary' }}
                    label="↑ ↓ navigate · Enter run · Esc close · Tab next"
                  />
                </Box>
              )}
            </Box>
          </Animated.View>
        </View>
      </View>
    </ModalRoot>
  );
}
