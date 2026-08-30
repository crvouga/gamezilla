import { useTimers } from '@pkgs/clock';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Platform, type FlatList as RNFlatList } from 'react-native';

import { startTiming } from '../../animation/run-timing';
import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import type { ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { duration as motionDuration } from '../../theme/motion';
import { borderRadius } from '../../theme/scale';
import { AnimatedBox } from '../animated-box';
import { Box } from '../box';
import { FlatList } from '../flat-list';
import { ModalRoot } from '../modal/modal-root';
import { Pressable } from '../pressable';
import { ProgressBar } from '../progress-bar';
import { Text } from '../text';
import { buildPaletteRows, type PaletteRow } from './build-palette-rows';
import { CommandPaletteEmpty } from './command-palette-empty';
import { CommandPaletteInput } from './command-palette-input';
import { CommandPaletteItem } from './command-palette-item';
import { useCommandRegistry } from './command-registry-context';

const LIST_MAX_HEIGHT = 320;
const TOP_INSET = 12;

export type CommandPaletteProps = {
  /** Hint shown under the list (e.g. keyboard shortcuts). */
  footerLegend?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

type ItemRow = Extract<PaletteRow, { kind: 'item' }>;

function useStoreSubscriptions(
  store: ReturnType<typeof useCommandRegistry>['store'],
  historyStore: ReturnType<typeof useCommandRegistry>['historyStore']
) {
  const [, setStoreTick] = useState(0);
  const [, setHistoryTick] = useState(0);
  useEffect(() => store.subscribe(() => setStoreTick((n) => n + 1)), [store]);
  useEffect(
    () => historyStore.subscribe(() => setHistoryTick((n) => n + 1)),
    [historyStore]
  );
}

function useOpenAnimation(isOpen: boolean) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;
  useEffect(() => {
    if (isOpen) {
      startTiming(opacity, {
        toValue: 1,
        duration: motionDuration.fast,
        useNativeDriver: USE_NATIVE_DRIVER,
      });
      startTiming(translateY, {
        toValue: 0,
        duration: motionDuration.fast,
        useNativeDriver: USE_NATIVE_DRIVER,
      });
    } else {
      opacity.setValue(0);
      translateY.setValue(-8);
    }
  }, [isOpen, opacity, translateY]);
  return { opacity, translateY };
}

function useClampedSelection(
  selectedIndex: number,
  selectableCount: number,
  setSelectedIndex: (updater: number | ((i: number) => number)) => void,
  query: string
) {
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
}

type ScrollDeps = {
  flatListRef: React.RefObject<RNFlatList<PaletteRow> | null>;
  isOpen: boolean;
  itemRows: ItemRow[];
  rows: PaletteRow[];
  selectedIndex: number;
};

function useScrollToSelected({
  flatListRef,
  isOpen,
  itemRows,
  rows,
  selectedIndex,
}: ScrollDeps) {
  useEffect(() => {
    if (!isOpen || itemRows.length === 0) return;
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
  }, [flatListRef, isOpen, itemRows, rows, selectedIndex]);
}

type KeyHandlerDeps = {
  isOpen: boolean;
  runningId: string | null;
  itemRows: ItemRow[];
  selectedIndex: number;
  setSelectedIndex: (updater: number | ((i: number) => number)) => void;
  close: () => void;
  invoke: (id: string) => Promise<void> | void;
};

function handleArrowKey(
  e: KeyboardEvent,
  n: number,
  setSelectedIndex: KeyHandlerDeps['setSelectedIndex']
): boolean {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setSelectedIndex((i) => (i + 1) % n);
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    setSelectedIndex((i) => (i - 1 + n) % n);
    return true;
  }
  return false;
}

function handleEdgeKey(
  e: KeyboardEvent,
  n: number,
  setSelectedIndex: KeyHandlerDeps['setSelectedIndex']
): boolean {
  if (e.key === 'Home') {
    e.preventDefault();
    setSelectedIndex(0);
    return true;
  }
  if (e.key === 'End') {
    e.preventDefault();
    setSelectedIndex(n - 1);
    return true;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    setSelectedIndex((i) => (e.shiftKey ? (i - 1 + n) % n : (i + 1) % n));
    return true;
  }
  return false;
}

function useKeyNavigation(deps: KeyHandlerDeps) {
  const {
    isOpen,
    runningId,
    itemRows,
    selectedIndex,
    setSelectedIndex,
    close,
    invoke,
  } = deps;
  return useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || runningId !== null) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      const n = itemRows.length;
      if (n === 0) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = itemRows[selectedIndex]?.command;
        if (cmd !== undefined) void invoke(cmd.id);
        return;
      }
      if (handleArrowKey(e, n, setSelectedIndex)) return;
      handleEdgeKey(e, n, setSelectedIndex);
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
}

function useWebKeydown(
  isOpen: boolean,
  onKeyNavigation: (e: KeyboardEvent) => void
) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen) return;
    const onDown = (ev: KeyboardEvent) => onKeyNavigation(ev);
    window.addEventListener('keydown', onDown, true);
    return () => window.removeEventListener('keydown', onDown, true);
  }, [isOpen, onKeyNavigation]);
}

function PaletteHeader({
  row,
}: {
  row: Extract<PaletteRow, { kind: 'header' }>;
}) {
  return (
    <Box sx={{ px: 3, py: 2, background: 'background' }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary', letterSpacing: 0.5 }}
        label={row.title}
      />
    </Box>
  );
}

type RenderRowDeps = {
  itemRows: ItemRow[];
  selectedIndex: number;
  runningId: string | null;
  query: string;
  getError: (id: string) => string | undefined;
  invoke: (id: string) => Promise<void> | void;
};

function renderPaletteRow(
  item: PaletteRow,
  deps: RenderRowDeps
): React.ReactElement {
  if (item.kind === 'header') return <PaletteHeader row={item} />;
  const { itemRows, selectedIndex, runningId, query, getError, invoke } = deps;
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
        if (runningId === null) void invoke(item.command.id);
      }}
    />
  );
}

function PaletteList({
  rows,
  flatListRef,
  renderDeps,
}: {
  rows: PaletteRow[];
  flatListRef: React.RefObject<RNFlatList<PaletteRow> | null>;
  renderDeps: RenderRowDeps;
}) {
  const timers = useTimers();
  return (
    <FlatList
      ref={flatListRef}
      keyboardShouldPersistTaps="handled"
      frameSx={{ maxHeight: LIST_MAX_HEIGHT }}
      data={rows}
      keyExtractor={(item) => item.key}
      onScrollToIndexFailed={({ index }) => {
        timers.setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, viewPosition: 0.4 });
        }, 100);
      }}
      renderItem={({ item }) => renderPaletteRow(item, renderDeps)}
    />
  );
}

function PaletteFooter({ legend }: { legend: string | undefined }) {
  const label = legend ?? '↑ ↓ navigate · Enter run · Esc close · Tab next';
  return (
    <Box sx={{ px: 3, pb: 2, pt: 1 }}>
      <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
    </Box>
  );
}

function PaletteCard({
  runningId,
  query,
  setQuery,
  isOpen,
  rows,
  flatListRef,
  renderDeps,
  footerLegend,
}: {
  runningId: string | null;
  query: string;
  setQuery: (s: string) => void;
  isOpen: boolean;
  rows: PaletteRow[];
  flatListRef: React.RefObject<RNFlatList<PaletteRow> | null>;
  renderDeps: RenderRowDeps;
  footerLegend: string | undefined;
}) {
  const theme = useTheme();
  const lift = theme.elevation(5);
  const bg = lift.backgroundColor ?? theme.colors.surfaceOverlay;
  return (
    <Box
      sx={{
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'border',
        overflow: 'hidden',
        elevation: 5,
        backgroundColor: bg,
      }}
    >
      {runningId !== null ? (
        <ProgressBar indeterminate height={2} color="tint" />
      ) : (
        <Box sx={{ height: 2 }} />
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
        <PaletteList
          rows={rows}
          flatListRef={flatListRef}
          renderDeps={renderDeps}
        />
      )}
      <PaletteFooter legend={footerLegend} />
    </Box>
  );
}

function PaletteOverlay({
  opacity,
  translateY,
  close,
  children,
  dataSet,
}: {
  opacity: Animated.Value;
  translateY: Animated.Value;
  close: () => void;
  children: ReactNode;
  dataSet: ComponentDataSet | undefined;
}) {
  return (
    <Box sx={{ flex: 1 }} dataSet={{ component: 'CommandPalette', ...dataSet }}>
      <Pressable
        accessibilityLabel="Dismiss command palette"
        onPress={close}
        feedback="none"
        sx={{ flex: 1, backgroundColor: 'scrim' }}
      />
      <Box
        pointerEvents="box-none"
        sx={{
          position: 'absolute',
          top: TOP_INSET + 48,
          left: 0,
          right: 0,
          alignItems: 'center',
          paddingHorizontal: 16,
        }}
      >
        <AnimatedBox
          sx={{
            width: '100%',
            opacity,
            transform: [{ translateY }],
          }}
        >
          {children}
        </AnimatedBox>
      </Box>
    </Box>
  );
}

export function CommandPalette({ footerLegend, dataSet }: CommandPaletteProps) {
  const reg = useCommandRegistry();
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
  } = reg;

  useStoreSubscriptions(store, historyStore);

  const { rows, selectableCount } = useMemo(
    () => buildPaletteRows(store.getAll(), query, historyStore.getIds()),
    [store, query, historyStore]
  );
  const itemRows = useMemo(
    () => rows.filter((r): r is ItemRow => r.kind === 'item'),
    [rows]
  );

  useClampedSelection(selectedIndex, selectableCount, setSelectedIndex, query);
  const { opacity, translateY } = useOpenAnimation(isOpen);
  const flatListRef = useRef<RNFlatList<PaletteRow>>(null);
  useScrollToSelected({ flatListRef, isOpen, itemRows, rows, selectedIndex });

  const onKeyNavigation = useKeyNavigation({
    isOpen,
    runningId,
    itemRows,
    selectedIndex,
    setSelectedIndex,
    close,
    invoke,
  });
  useWebKeydown(isOpen, onKeyNavigation);

  return (
    <ModalRoot visible={isOpen} onRequestClose={close}>
      <PaletteOverlay
        opacity={opacity}
        translateY={translateY}
        close={close}
        dataSet={dataSet}
      >
        <PaletteCard
          runningId={runningId}
          query={query}
          setQuery={setQuery}
          isOpen={isOpen}
          rows={rows}
          flatListRef={flatListRef}
          renderDeps={{
            itemRows,
            selectedIndex,
            runningId,
            query,
            getError,
            invoke,
          }}
          footerLegend={footerLegend}
        />
      </PaletteOverlay>
    </ModalRoot>
  );
}
