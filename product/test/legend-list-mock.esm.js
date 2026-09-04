/**
 * bun:test stand-in for `@legendapp/list`.
 *
 * LegendList virtualizes against measured layout; react-test-renderer has no
 * real viewport, so items never mount and sim waits for testIDs time out.
 * Render the full data set like a plain ScrollView map.
 */
import * as React from 'react';
import { ScrollView, View } from 'react-native';

function renderRow(renderItem, item, index) {
  if (typeof renderItem === 'function') {
    return renderItem({ item, index });
  }
  return React.createElement(renderItem, { item, index });
}

function maybeElement(value) {
  if (value == null) return null;
  if (React.isValidElement(value)) return value;
  if (typeof value === 'function') return React.createElement(value);
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof value.default === 'function'
  ) {
    return React.createElement(value.default);
  }
  return null;
}

export function LegendList(props) {
  const {
    data = [],
    renderItem,
    keyExtractor,
    ListEmptyComponent,
    ListHeaderComponent,
    ListFooterComponent,
    style,
    contentContainerStyle,
    testID,
  } = props;

  return React.createElement(
    ScrollView,
    { style, contentContainerStyle, testID },
    maybeElement(ListHeaderComponent),
    data.length === 0
      ? maybeElement(ListEmptyComponent)
      : data.map((item, index) => {
          const key =
            typeof keyExtractor === 'function'
              ? keyExtractor(item, index)
              : String(index);
          return React.createElement(
            View,
            { key },
            renderRow(renderItem, item, index)
          );
        }),
    maybeElement(ListFooterComponent)
  );
}

export default LegendList;
