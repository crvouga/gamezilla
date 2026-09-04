/**
 * Jest mock for `@legendapp/list`.
 *
 * LegendList virtualizes against measured layout; react-test-renderer has no
 * real viewport, so items never mount and sim waits for testIDs time out.
 * Render the full data set like a plain ScrollView map.
 */

'use strict';

const React = require('react');
const { ScrollView, View } = require('react-native');

function renderRow(renderItem, item, index) {
  if (typeof renderItem === 'function') {
    return renderItem({ item, index });
  }
  return React.createElement(renderItem, { item, index });
}

function maybeElement(value) {
  if (value == null) return null;
  if (React.isValidElement(value)) return value;
  return React.createElement(value);
}

function LegendList(props) {
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

module.exports = {
  LegendList,
  __esModule: true,
  default: LegendList,
};
